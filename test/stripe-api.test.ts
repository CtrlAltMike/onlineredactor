// @vitest-environment node

import { Miniflare } from 'miniflare';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createCheckoutSession,
  createPortalSession,
  handleStripeWebhook,
  verifyStripeSignature,
  type StripeEnv,
} from '@/lib/cloudflare/stripe-api';
import {
  requestMagicLink,
  verifyMagicLink,
} from '@/lib/cloudflare/account-api';
import { createTestEnv, jsonRequest } from './cloudflare-test-env';

let miniflare: Miniflare | null = null;

describe('Stripe API', () => {
  afterEach(async () => {
    vi.unstubAllGlobals();
    await miniflare?.dispose();
    miniflare = null;
  });

  it('keeps checkout disabled by default', async () => {
    const { env } = await stripeTestEnv();
    const cookie = await signInCookie(env);

    const response = await createCheckoutSession(
      authedPost('/api/stripe/checkout', cookie),
      env
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: 'Stripe checkout is disabled.',
    });
  });

  it('blocks live Stripe keys unless live mode is explicitly allowed', async () => {
    const { env } = await stripeTestEnv({
      STRIPE_CHECKOUT_ENABLED: 'true',
      STRIPE_SECRET_KEY: 'sk_live_blocked',
      STRIPE_PRO_PRICE_ID: 'price_pro',
    });
    const cookie = await signInCookie(env);

    const response = await createCheckoutSession(
      authedPost('/api/stripe/checkout', cookie),
      env
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: expect.stringMatching(/live stripe keys/i),
    });
  });

  it('creates a test-mode Checkout Session with content-free metadata', async () => {
    const { env } = await stripeTestEnv({
      STRIPE_CHECKOUT_ENABLED: 'true',
      STRIPE_SECRET_KEY: 'sk_test_ok',
      STRIPE_PRO_PRICE_ID: 'price_pro',
    });
    const cookie = await signInCookie(env);
    const requests: URLSearchParams[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        requests.push(init.body as URLSearchParams);
        const body = init.body as URLSearchParams;
        if (body.get('email')) {
          return jsonResponse({ id: 'cus_test' });
        }
        return jsonResponse({ url: 'https://checkout.stripe.test/session' });
      })
    );

    const response = await createCheckoutSession(
      authedPost('/api/stripe/checkout', cookie),
      env
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: 'https://checkout.stripe.test/session',
    });
    const checkoutBody = requests[1];
    expect(checkoutBody.get('mode')).toBe('subscription');
    expect(checkoutBody.get('line_items[0][price]')).toBe('price_pro');
    expect(checkoutBody.get('metadata[user_id]')).toMatch(/[a-f0-9-]+/);
    expect(checkoutBody.toString()).not.toContain('sample.pdf');
    expect(checkoutBody.toString()).not.toContain('123-45-6789');
  });

  it('creates a portal session only when a Stripe customer exists', async () => {
    const { env } = await stripeTestEnv({ STRIPE_SECRET_KEY: 'sk_test_ok' });
    const cookie = await signInCookie(env);

    const missing = await createPortalSession(
      authedPost('/api/stripe/portal', cookie),
      env
    );
    expect(missing.status).toBe(409);

    await env.DB.prepare(
      `UPDATE subscriptions SET stripe_customer_id = ? WHERE user_id IN
       (SELECT id FROM users WHERE email = ?)`
    )
      .bind('cus_test', 'jane@example.com')
      .run();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ url: 'https://billing.stripe.test/session' })
      )
    );

    const response = await createPortalSession(
      authedPost('/api/stripe/portal', cookie),
      env
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: 'https://billing.stripe.test/session',
    });
  });

  it('verifies Stripe signatures and rejects bad webhook signatures', async () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated' });
    const signature = await stripeSignature(payload, 'whsec_test');

    await expect(
      verifyStripeSignature(payload, signature, 'whsec_test')
    ).resolves.toBe(true);

    const { env } = await stripeTestEnv({ STRIPE_WEBHOOK_SECRET: 'whsec_test' });
    const response = await handleStripeWebhook(
      new Request('https://example.com/api/stripe/webhook', {
        method: 'POST',
        headers: { 'Stripe-Signature': 't=1,v1=bad' },
        body: payload,
      }),
      env
    );

    expect(response.status).toBe(400);
  });

  it('processes subscription webhooks idempotently', async () => {
    const { env } = await stripeTestEnv({ STRIPE_WEBHOOK_SECRET: 'whsec_test' });
    await signInCookie(env);
    await env.DB.prepare(
      `UPDATE subscriptions SET stripe_customer_id = ? WHERE user_id IN
       (SELECT id FROM users WHERE email = ?)`
    )
      .bind('cus_test', 'jane@example.com')
      .run();

    const payload = JSON.stringify({
      id: 'evt_subscription_active',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test',
          customer: 'cus_test',
          status: 'active',
          current_period_end: 1770000000,
          metadata: {},
        },
      },
    });
    const request = () =>
      new Request('https://example.com/api/stripe/webhook', {
        method: 'POST',
        headers: {
          'Stripe-Signature': '',
        },
        body: payload,
      });
    const signature = await stripeSignature(payload, 'whsec_test');

    const first = await handleStripeWebhook(
      withSignature(request(), signature),
      env
    );
    const second = await handleStripeWebhook(
      withSignature(request(), signature),
      env
    );

    expect(first.status).toBe(200);
    expect(await second.json()).toMatchObject({ duplicate: true });
    const subscription = await env.DB.prepare(
      'SELECT plan, status, stripe_subscription_id FROM subscriptions'
    ).first<{
      plan: string;
      status: string;
      stripe_subscription_id: string;
    }>();
    expect(subscription).toEqual({
      plan: 'pro',
      status: 'active',
      stripe_subscription_id: 'sub_test',
    });
    const eventCount = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM stripe_events'
    ).first<{ count: number }>();
    expect(eventCount?.count).toBe(1);
  });
});

async function stripeTestEnv(overrides: Partial<StripeEnv> = {}) {
  const test = await createTestEnv();
  miniflare = test.miniflare;
  return { env: { ...test.env, ...overrides } as StripeEnv };
}

async function signInCookie(env: StripeEnv) {
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

function authedPost(path: string, cookie: string): Request {
  return new Request(`https://example.com${path}`, {
    method: 'POST',
    headers: { Cookie: cookie },
  });
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function stripeSignature(payload: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
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
    new TextEncoder().encode(signedPayload)
  );
  const hex = Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return `t=${timestamp},v1=${hex}`;
}

function withSignature(request: Request, signature: string) {
  return new Request(request, {
    headers: { 'Stripe-Signature': signature },
  });
}
