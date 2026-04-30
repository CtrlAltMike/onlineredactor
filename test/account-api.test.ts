// @vitest-environment node

import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deleteAccount,
  getAccount,
  joinWaitlist,
  normalizeEmail,
  requestMagicLink,
  verifyMagicLink,
  type AccountEnv,
} from '@/lib/cloudflare/account-api';

let miniflare: Miniflare | null = null;

describe('Cloudflare account API', () => {
  afterEach(async () => {
    await miniflare?.dispose();
    miniflare = null;
  });

  it('normalizes valid email and rejects invalid email', () => {
    expect(normalizeEmail('  Jane@Example.COM ')).toBe('jane@example.com');
    expect(normalizeEmail('not-email')).toBeNull();
  });

  it('creates a magic-link session, returns content-free account data, and deletes account state', async () => {
    const env = await testEnv();

    const requestResponse = await requestMagicLink(
      jsonRequest('/api/auth/request', { email: 'jane@example.com' }),
      env
    );
    expect(requestResponse.status).toBe(200);
    const requestBody = (await requestResponse.json()) as {
      deliveryConfigured: boolean;
      devMagicLink: string;
    };
    expect(requestBody.deliveryConfigured).toBe(false);
    expect(requestBody.devMagicLink).toContain('/api/auth/verify?token=');

    const verifyResponse = await verifyMagicLink(
      new Request(requestBody.devMagicLink),
      env
    );
    expect(verifyResponse.status).toBe(302);
    const cookie = verifyResponse.headers.get('Set-Cookie');
    expect(cookie).toContain('or_session=');

    const accountResponse = await getAccount(
      new Request('https://example.com/api/account', {
        headers: { Cookie: cookie ?? '' },
      }),
      env
    );
    expect(accountResponse.status).toBe(200);
    const account = (await accountResponse.json()) as {
      user: { email: string };
      plan: string;
      guarantees: Record<string, boolean>;
    };
    expect(account.user.email).toBe('jane@example.com');
    expect(account.plan).toBe('free');
    expect(account.guarantees).toEqual({
      storesPdfBytes: false,
      storesFilenames: false,
      storesRedactionText: false,
      storesCoordinates: false,
    });
    expect(JSON.stringify(account)).not.toContain('123-45-6789');
    expect(JSON.stringify(account)).not.toContain('sample.pdf');

    const deleteResponse = await deleteAccount(
      new Request('https://example.com/api/account', {
        method: 'DELETE',
        headers: { Cookie: cookie ?? '' },
      }),
      env
    );
    expect(deleteResponse.status).toBe(200);

    const afterDeleteResponse = await getAccount(
      new Request('https://example.com/api/account', {
        headers: { Cookie: cookie ?? '' },
      }),
      env
    );
    expect(afterDeleteResponse.status).toBe(401);
  });

  it('sends magic links through the Cloudflare Email binding when configured', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const env = {
      ...(await testEnv()),
      EMAIL: { send },
      AUTH_EMAIL_FROM: 'login@example.com',
      AUTH_DEV_SHOW_MAGIC_LINK: 'false',
    };

    const response = await requestMagicLink(
      jsonRequest('/api/auth/request', { email: 'jane@example.com' }),
      env
    );

    const body = (await response.json()) as {
      deliveryConfigured: boolean;
      devMagicLink?: string;
      message: string;
    };
    expect(body.deliveryConfigured).toBe(true);
    expect(body.devMagicLink).toBeUndefined();
    expect(body.message).toMatch(/check your email/i);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        from: 'login@example.com',
        subject: 'Sign in to OnlineRedactor',
      })
    );
  });

  it('stores waitlist email without document data', async () => {
    const env = await testEnv();

    const response = await joinWaitlist(
      jsonRequest('/api/waitlist', {
        email: 'buyer@example.com',
        source: 'upgrade',
      }),
      env
    );

    expect(response.status).toBe(200);
    const row = await env.DB.prepare('SELECT email, source FROM waitlist').first<{
      email: string;
      source: string;
    }>();
    expect(row).toEqual({ email: 'buyer@example.com', source: 'upgrade' });
  });
});

async function testEnv(): Promise<AccountEnv> {
  miniflare = new Miniflare({
    modules: true,
    script: 'export default {}',
    d1Databases: ['DB'],
  });
  const db = await miniflare.getD1Database('DB');
  const migration = readFileSync('migrations/0001_phase4_accounts.sql', 'utf8');
  for (const statement of migration.split(/;\s*\n/)) {
    const sql = statement.trim();
    if (sql) await db.prepare(`${sql};`).run();
  }
  return {
    DB: db,
    APP_BASE_URL: 'https://example.com',
    AUTH_DEV_SHOW_MAGIC_LINK: 'true',
    COOKIE_SECURE: 'false',
  };
}

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`https://example.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
