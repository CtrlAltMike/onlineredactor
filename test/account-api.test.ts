// @vitest-environment node

import { Miniflare } from 'miniflare';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deleteAccount,
  getAccount,
  isActivePro,
  joinWaitlist,
  normalizeEmail,
  recordClientEvent,
  recordVerifiedRedactionUsage,
  requestMagicLink,
  verifyMagicLink,
} from '@/lib/cloudflare/account-api';
import { createTestEnv, jsonRequest } from './cloudflare-test-env';

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
    const { env } = await testEnv();

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
      ...(await testEnv()).env,
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
    const { env } = await testEnv();

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

  it('records only content-free account usage and allowlisted client events', async () => {
    const { env } = await testEnv();
    const cookie = await signInCookie(env);

    const usageResponse = await recordVerifiedRedactionUsage(
      new Request('https://example.com/api/usage/redaction', {
        method: 'POST',
        headers: { Cookie: cookie },
      }),
      env
    );
    expect(usageResponse.status).toBe(200);

    const eventResponse = await recordClientEvent(
      new Request('https://example.com/api/client-event', {
        method: 'POST',
        headers: {
          Cookie: cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventCode: 'checkout_disabled',
          route: '/upgrade',
          ignored: '123-45-6789',
        }),
      }),
      env
    );
    expect(eventResponse.status).toBe(200);

    const usage = await env.DB.prepare(
      'SELECT event_type, metadata_json FROM usage_events'
    ).first<{ event_type: string; metadata_json: string }>();
    expect(usage).toEqual({
      event_type: 'redaction_verified',
      metadata_json: '{}',
    });

    const event = await env.DB.prepare(
      'SELECT event_code, route FROM client_events'
    ).first<{ event_code: string; route: string }>();
    expect(event).toEqual({
      event_code: 'checkout_disabled',
      route: '/upgrade',
    });
  });

  it('rejects arbitrary client events and routes', async () => {
    const { env } = await testEnv();
    const response = await recordClientEvent(
      jsonRequest('/api/client-event', {
        eventCode: 'sample.pdf',
        route: '/app?file=sample.pdf',
      }),
      env
    );

    expect(response.status).toBe(400);
  });

  it('recognizes only active or trialing Pro subscriptions', () => {
    expect(isActivePro('pro', 'active')).toBe(true);
    expect(isActivePro('pro', 'trialing')).toBe(true);
    expect(isActivePro('pro', 'past_due')).toBe(false);
    expect(isActivePro('free', 'active')).toBe(false);
  });
});

async function testEnv() {
  const test = await createTestEnv();
  miniflare = test.miniflare;
  return test;
}

async function signInCookie(env: Awaited<ReturnType<typeof testEnv>>['env']) {
  const requestResponse = await requestMagicLink(
    jsonRequest('/api/auth/request', { email: 'jane@example.com' }),
    env
  );
  const requestBody = (await requestResponse.json()) as { devMagicLink: string };
  const verifyResponse = await verifyMagicLink(
    new Request(requestBody.devMagicLink),
    env
  );
  return verifyResponse.headers.get('Set-Cookie') ?? '';
}
