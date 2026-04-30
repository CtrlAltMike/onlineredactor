import type { D1Database } from '@cloudflare/workers-types';
import {
  requireSession,
  type AccountEnv,
} from './account-api';

export type StripeEnv = AccountEnv & {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRO_PRICE_ID?: string;
  STRIPE_CHECKOUT_ENABLED?: string;
  STRIPE_LIVE_MODE_ALLOWED?: string;
  APP_BASE_URL?: string;
};

type StripeCheckoutSession = {
  id: string;
  customer?: string | { id?: string } | null;
  subscription?: string | StripeSubscription | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  payment_status?: string | null;
};

type StripeSubscription = {
  id: string;
  customer?: string | { id?: string } | null;
  status?: string | null;
  current_period_end?: number | null;
  metadata?: Record<string, string> | null;
};

type StripeEvent = {
  id: string;
  type: string;
  data?: { object?: unknown };
};

type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

const stripeApiBase = 'https://api.stripe.com/v1';
const allowedSubscriptionStatuses = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'paused',
]);

export async function createCheckoutSession(
  request: Request,
  env: StripeEnv
): Promise<Response> {
  const session = await requireSession(request, env);
  if (!session) return json({ error: 'Sign in before upgrading.' }, 401);

  const config = stripeConfig(env);
  if (!config.ok) return json({ error: config.error }, config.status);

  const subscription = await env.DB.prepare(
    `SELECT stripe_customer_id, stripe_subscription_id
     FROM subscriptions
     WHERE user_id = ?`
  )
    .bind(session.user_id)
    .first<{
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
    }>();

  const customerId =
    subscription?.stripe_customer_id ||
    (await createStripeCustomer(env, session.user_id, session.email));
  if (!subscription?.stripe_customer_id) {
    await env.DB.prepare(
      `UPDATE subscriptions
       SET stripe_customer_id = ?, updated_at = ?
       WHERE user_id = ?`
    )
      .bind(customerId, new Date().toISOString(), session.user_id)
      .run();
  }

  const baseUrl = appBaseUrl(request, env);
  const body = new URLSearchParams();
  body.set('mode', 'subscription');
  body.set('customer', customerId);
  body.set('client_reference_id', session.user_id);
  body.set('line_items[0][price]', env.STRIPE_PRO_PRICE_ID ?? '');
  body.set('line_items[0][quantity]', '1');
  body.set('success_url', `${baseUrl}/account?checkout=success`);
  body.set('cancel_url', `${baseUrl}/upgrade?checkout=cancelled`);
  body.set('metadata[user_id]', session.user_id);
  body.set('subscription_data[metadata][user_id]', session.user_id);

  const stripeSession = await stripeFetch<{ url?: string }>(
    env,
    '/checkout/sessions',
    body
  );
  if (!stripeSession.url) {
    return json({ error: 'Stripe did not return a checkout URL.' }, 502);
  }
  return json({ url: stripeSession.url });
}

export async function createPortalSession(
  request: Request,
  env: StripeEnv
): Promise<Response> {
  const session = await requireSession(request, env);
  if (!session) return json({ error: 'Sign in before opening billing.' }, 401);

  const config = stripeSecretConfig(env);
  if (!config.ok) return json({ error: config.error }, config.status);

  const subscription = await env.DB.prepare(
    `SELECT stripe_customer_id
     FROM subscriptions
     WHERE user_id = ?`
  )
    .bind(session.user_id)
    .first<{ stripe_customer_id: string | null }>();
  if (!subscription?.stripe_customer_id) {
    return json({ error: 'No Stripe customer is attached to this account yet.' }, 409);
  }

  const body = new URLSearchParams();
  body.set('customer', subscription.stripe_customer_id);
  body.set('return_url', `${appBaseUrl(request, env)}/account`);

  const portalSession = await stripeFetch<{ url?: string }>(
    env,
    '/billing_portal/sessions',
    body
  );
  if (!portalSession.url) {
    return json({ error: 'Stripe did not return a billing portal URL.' }, 502);
  }
  return json({ url: portalSession.url });
}

export async function handleStripeWebhook(
  request: Request,
  env: StripeEnv
): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: 'Stripe webhook is not configured.' }, 503);
  }

  const rawBody = await request.text();
  const signature = request.headers.get('Stripe-Signature');
  const verified = await verifyStripeSignature(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );
  if (!verified) return json({ error: 'Invalid Stripe signature.' }, 400);

  const event = JSON.parse(rawBody) as StripeEvent;
  const payloadSha256 = await sha256Hex(rawBody);
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO stripe_events
       (id, stripe_event_id, type, payload_sha256, processed_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      event.id,
      event.type,
      payloadSha256,
      new Date().toISOString()
    )
    .run();

  if ((inserted.meta?.changes ?? 0) === 0) {
    return json({ ok: true, duplicate: true });
  }

  await processStripeEvent(env, event);
  return json({ ok: true });
}

async function processStripeEvent(env: StripeEnv, event: StripeEvent) {
  const object = event.data?.object;
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(env, object as StripeCheckoutSession);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await upsertSubscriptionFromStripe(env.DB, object as StripeSubscription);
      break;
    case 'invoice.payment_failed':
      await markCustomerPastDue(env.DB, customerIdFromObject(object));
      break;
  }
}

async function handleCheckoutCompleted(
  env: StripeEnv,
  checkout: StripeCheckoutSession
) {
  const userId = checkout.client_reference_id || checkout.metadata?.user_id;
  if (!userId) return;

  const customerId = stripeId(checkout.customer);
  const subscription = checkout.subscription;
  const subscriptionId =
    typeof subscription === 'string' ? subscription : subscription?.id;
  await env.DB.prepare(
    `UPDATE subscriptions
     SET plan = 'pro',
         status = ?,
         stripe_customer_id = COALESCE(?, stripe_customer_id),
         stripe_subscription_id = COALESCE(?, stripe_subscription_id),
         current_period_end = COALESCE(?, current_period_end),
         updated_at = ?
     WHERE user_id = ?`
  )
    .bind(
      checkout.payment_status === 'paid' ? 'active' : 'incomplete',
      customerId,
      subscriptionId ?? null,
      subscription && typeof subscription === 'object'
        ? unixToIso(subscription.current_period_end)
        : null,
      new Date().toISOString(),
      userId
    )
    .run();
}

async function upsertSubscriptionFromStripe(
  db: D1Database,
  subscription: StripeSubscription
) {
  const customerId = stripeId(subscription.customer);
  const userId = subscription.metadata?.user_id;
  const row = await findSubscriptionRow(db, subscription.id, customerId, userId);
  if (!row) return;

  const status = normalizedSubscriptionStatus(subscription.status);
  await db.prepare(
    `UPDATE subscriptions
     SET plan = ?,
         status = ?,
         stripe_customer_id = COALESCE(?, stripe_customer_id),
         stripe_subscription_id = ?,
         current_period_end = ?,
         updated_at = ?
     WHERE user_id = ?`
  )
    .bind(
      status === 'active' || status === 'trialing' ? 'pro' : 'free',
      status,
      customerId,
      subscription.id,
      unixToIso(subscription.current_period_end),
      new Date().toISOString(),
      row.user_id
    )
    .run();
}

async function markCustomerPastDue(
  db: D1Database,
  customerId: string | null
) {
  if (!customerId) return;
  await db.prepare(
    `UPDATE subscriptions
     SET status = 'past_due',
         plan = 'free',
         updated_at = ?
     WHERE stripe_customer_id = ?`
  )
    .bind(new Date().toISOString(), customerId)
    .run();
}

async function findSubscriptionRow(
  db: D1Database,
  subscriptionId: string,
  customerId: string | null,
  userId: string | undefined
): Promise<SubscriptionRow | null> {
  if (userId) {
    const row = await db.prepare(
      `SELECT user_id, stripe_customer_id, stripe_subscription_id
       FROM subscriptions
       WHERE user_id = ?`
    )
      .bind(userId)
      .first<SubscriptionRow>();
    if (row) return row;
  }
  if (customerId) {
    const row = await db.prepare(
      `SELECT user_id, stripe_customer_id, stripe_subscription_id
       FROM subscriptions
       WHERE stripe_customer_id = ?`
    )
      .bind(customerId)
      .first<SubscriptionRow>();
    if (row) return row;
  }
  return db.prepare(
    `SELECT user_id, stripe_customer_id, stripe_subscription_id
     FROM subscriptions
     WHERE stripe_subscription_id = ?`
  )
    .bind(subscriptionId)
    .first<SubscriptionRow>();
}

async function createStripeCustomer(
  env: StripeEnv,
  userId: string,
  email: string
): Promise<string> {
  const body = new URLSearchParams();
  body.set('email', email);
  body.set('metadata[user_id]', userId);
  const customer = await stripeFetch<{ id?: string }>(env, '/customers', body);
  if (!customer.id) throw new Error('Stripe did not return a customer ID.');
  return customer.id;
}

async function stripeFetch<T>(
  env: StripeEnv,
  path: string,
  body: URLSearchParams
): Promise<T> {
  const config = stripeSecretConfig(env);
  if (!config.ok) throw new Error(config.error);

  const response = await fetch(`${stripeApiBase}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Stripe request failed.');
  }
  return data;
}

function stripeConfig(env: StripeEnv):
  | { ok: true }
  | { ok: false; error: string; status: number } {
  if (env.STRIPE_CHECKOUT_ENABLED !== 'true') {
    return { ok: false, status: 503, error: 'Stripe checkout is disabled.' };
  }
  if (!env.STRIPE_PRO_PRICE_ID) {
    return { ok: false, status: 503, error: 'Stripe price is not configured.' };
  }
  return stripeSecretConfig(env);
}

function stripeSecretConfig(env: StripeEnv):
  | { ok: true }
  | { ok: false; error: string; status: number } {
  if (!env.STRIPE_SECRET_KEY) {
    return { ok: false, status: 503, error: 'Stripe secret key is not configured.' };
  }
  if (
    env.STRIPE_SECRET_KEY.startsWith('sk_live_') &&
    env.STRIPE_LIVE_MODE_ALLOWED !== 'true'
  ) {
    return {
      ok: false,
      status: 503,
      error: 'Live Stripe keys are blocked until live mode is explicitly enabled.',
    };
  }
  return { ok: true };
}

export async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  now = Date.now()
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key, value];
    })
  );
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isFinite(timestamp) || !signature) return false;
  const toleranceSeconds = 300;
  if (Math.abs(Math.floor(now / 1000) - timestamp) > toleranceSeconds) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = await hmacSha256Hex(secret, signedPayload);
  return timingSafeEqualHex(expected, signature);
}

function customerIdFromObject(object: unknown): string | null {
  if (!object || typeof object !== 'object') return null;
  return stripeId((object as { customer?: unknown }).customer);
}

function stripeId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

function normalizedSubscriptionStatus(status: string | null | undefined): string {
  if (status && allowedSubscriptionStatuses.has(status)) return status;
  return 'incomplete';
}

function unixToIso(value: number | null | undefined): string | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}

function appBaseUrl(request: Request, env: StripeEnv): string {
  return env.APP_BASE_URL || new URL(request.url).origin;
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value)
  );
  return bytesToHex(new Uint8Array(signature));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(left: string, right: string): boolean {
  const leftBytes = hexToBytes(left);
  const rightBytes = hexToBytes(right);
  let diff = leftBytes.length ^ rightBytes.length;
  const length = Math.max(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[a-f0-9]+$/i.test(hex) || hex.length % 2 !== 0) {
    return new Uint8Array();
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
