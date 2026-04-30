import type { D1Database } from '@cloudflare/workers-types';

type EmailSender = {
  send(message: {
    to: string;
    from: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void>;
};

export type AccountEnv = {
  DB: D1Database;
  EMAIL?: EmailSender;
  APP_BASE_URL?: string;
  AUTH_EMAIL_FROM?: string;
  AUTH_DEV_SHOW_MAGIC_LINK?: string;
  COOKIE_SECURE?: string;
};

type UserRow = {
  id: string;
  email: string;
  created_at: string;
};

type SessionRow = {
  id: string;
  user_id: string;
  email: string;
};

const sessionCookieName = 'or_session';
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

export async function requestMagicLink(
  request: Request,
  env: AccountEnv
): Promise<Response> {
  const body = await readJson<{ email?: unknown }>(request);
  const email = normalizeEmail(body.email);
  if (!email) return json({ error: 'Enter a valid email address.' }, 400);

  const user = await upsertUser(env.DB, email);
  const token = randomToken();
  const now = new Date();
  const expiresAt = addMinutes(now, 15).toISOString();
  await env.DB.prepare(
    `INSERT INTO auth_tokens (id, user_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(crypto.randomUUID(), user.id, await sha256Hex(token), now.toISOString(), expiresAt)
    .run();

  const baseUrl = env.APP_BASE_URL || new URL(request.url).origin;
  const magicLink = `${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const emailSent = await sendMagicLinkEmail(env, email, magicLink);
  const showDevLink = env.AUTH_DEV_SHOW_MAGIC_LINK === 'true';

  return json({
    ok: true,
    message: emailSent
      ? 'Check your email for a sign-in link.'
      : showDevLink
        ? 'Use the development sign-in link below.'
        : 'Sign-in email is not configured yet. Your address was saved.',
    devMagicLink: showDevLink ? magicLink : undefined,
    deliveryConfigured: emailSent,
  });
}

export async function verifyMagicLink(
  request: Request,
  env: AccountEnv
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || '';
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();
  const authToken = await env.DB.prepare(
    `SELECT auth_tokens.id, auth_tokens.user_id, users.email
     FROM auth_tokens
     JOIN users ON users.id = auth_tokens.user_id
     WHERE auth_tokens.token_hash = ?
       AND auth_tokens.used_at IS NULL
       AND auth_tokens.expires_at > ?
       AND users.deleted_at IS NULL`
  )
    .bind(tokenHash, now)
    .first<{ id: string; user_id: string; email: string }>();

  if (!authToken) return redirect('/account?error=expired');

  const sessionToken = randomToken();
  const expiresAt = addDays(new Date(), 30).toISOString();
  const sessionId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO sessions (id, user_id, session_hash, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      sessionId,
      authToken.user_id,
      await sha256Hex(sessionToken),
      now,
      expiresAt
    ),
    env.DB.prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ?').bind(
      now,
      authToken.id
    ),
  ]);

  return redirect('/account', {
    'Set-Cookie': sessionCookie(sessionToken, request, env),
  });
}

export async function getAccount(
  request: Request,
  env: AccountEnv
): Promise<Response> {
  const session = await requireSession(request, env);
  if (!session) return json({ error: 'Not signed in.' }, 401);

  const subscription = await env.DB.prepare(
    `SELECT plan, status, current_period_end
     FROM subscriptions
     WHERE user_id = ?`
  )
    .bind(session.user_id)
    .first<{ plan: string; status: string; current_period_end: string | null }>();

  const usage = await env.DB.prepare(
    `SELECT event_type, created_at, metadata_json
     FROM usage_events
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 20`
  )
    .bind(session.user_id)
    .all<{ event_type: string; created_at: string; metadata_json: string }>();

  return json({
    user: { id: session.user_id, email: session.email },
    plan: subscription?.plan ?? 'free',
    subscription: {
      status: subscription?.status ?? 'inactive',
      currentPeriodEnd: subscription?.current_period_end ?? null,
    },
    usageEvents: (usage.results ?? []).map((event) => ({
      type: event.event_type,
      createdAt: event.created_at,
      metadata: safeJson(event.metadata_json),
    })),
    guarantees: {
      storesPdfBytes: false,
      storesFilenames: false,
      storesRedactionText: false,
      storesCoordinates: false,
    },
  });
}

export async function deleteAccount(
  request: Request,
  env: AccountEnv
): Promise<Response> {
  const session = await requireSession(request, env);
  if (!session) return json({ error: 'Not signed in.' }, 401);

  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(session.user_id).run();
  return json(
    { ok: true },
    200,
    {
      'Set-Cookie': clearSessionCookie(),
    }
  );
}

export async function logout(
  request: Request,
  env: AccountEnv
): Promise<Response> {
  const token = readCookie(request.headers.get('Cookie'), sessionCookieName);
  if (token) {
    await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE session_hash = ?')
      .bind(new Date().toISOString(), await sha256Hex(token))
      .run();
  }

  return json(
    { ok: true },
    200,
    {
      'Set-Cookie': clearSessionCookie(),
    }
  );
}

export async function joinWaitlist(
  request: Request,
  env: AccountEnv
): Promise<Response> {
  const body = await readJson<{ email?: unknown; source?: unknown }>(request);
  const email = normalizeEmail(body.email);
  if (!email) return json({ error: 'Enter a valid email address.' }, 400);
  const source = typeof body.source === 'string' ? body.source.slice(0, 64) : 'upgrade';
  await env.DB.prepare(
    `INSERT INTO waitlist (id, email, source, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET source = excluded.source`
  )
    .bind(crypto.randomUUID(), email, source, new Date().toISOString())
    .run();
  return json({ ok: true });
}

async function upsertUser(db: D1Database, email: string): Promise<UserRow> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO users (id, email, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET deleted_at = NULL, updated_at = excluded.updated_at`
    )
    .bind(crypto.randomUUID(), email, now, now)
    .run();
  const user = await db
    .prepare('SELECT id, email, created_at FROM users WHERE email = ?')
    .bind(email)
    .first<UserRow>();
  if (!user) throw new Error('Failed to create user.');
  await db
    .prepare(
      `INSERT OR IGNORE INTO profiles (user_id, created_at, updated_at)
       VALUES (?, ?, ?)`
    )
    .bind(user.id, now, now)
    .run();
  await db
    .prepare(
      `INSERT OR IGNORE INTO subscriptions (user_id, plan, status, created_at, updated_at)
       VALUES (?, 'free', 'inactive', ?, ?)`
    )
    .bind(user.id, now, now)
    .run();
  return user;
}

async function sendMagicLinkEmail(
  env: AccountEnv,
  email: string,
  magicLink: string
): Promise<boolean> {
  if (!env.EMAIL || !env.AUTH_EMAIL_FROM) return false;

  await env.EMAIL.send({
    to: email,
    from: env.AUTH_EMAIL_FROM,
    subject: 'Sign in to OnlineRedactor',
    text: [
      'Use this link to sign in to OnlineRedactor:',
      '',
      magicLink,
      '',
      'This link expires in 15 minutes.',
    ].join('\n'),
    html: [
      '<p>Use this link to sign in to OnlineRedactor:</p>',
      `<p><a href="${escapeHtml(magicLink)}">Sign in to OnlineRedactor</a></p>`,
      '<p>This link expires in 15 minutes.</p>',
    ].join(''),
  });

  return true;
}

async function requireSession(
  request: Request,
  env: AccountEnv
): Promise<SessionRow | null> {
  const token = readCookie(request.headers.get('Cookie'), sessionCookieName);
  if (!token) return null;
  return env.DB.prepare(
    `SELECT sessions.id, sessions.user_id, users.email
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.session_hash = ?
       AND sessions.revoked_at IS NULL
       AND sessions.expires_at > ?
       AND users.deleted_at IS NULL`
  )
    .bind(await sha256Hex(token), new Date().toISOString())
    .first<SessionRow>();
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function base64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

function sessionCookie(
  token: string,
  request: Request,
  env: AccountEnv
): string {
  const secure =
    env.COOKIE_SECURE === 'false' ? false : new URL(request.url).protocol === 'https:';
  return [
    `${sessionCookieName}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${sessionMaxAgeSeconds}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function clearSessionCookie(): string {
  return `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const cookies = header.split(';').map((entry) => entry.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((entry) => entry.startsWith(prefix));
  return cookie ? cookie.slice(prefix.length) : null;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function redirect(path: string, headers?: HeadersInit): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: path,
      ...headers,
    },
  });
}

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}
