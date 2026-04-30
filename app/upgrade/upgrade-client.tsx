'use client';

import { FormEvent, useEffect, useState } from 'react';
import { WaitlistForm } from './waitlist-form';

type AccountState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; isPro: boolean }
  | { status: 'error'; message: string };

export function UpgradeClient() {
  const [account, setAccount] = useState<AccountState>({ status: 'loading' });
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/account', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401 || response.status === 404) {
          setAccount({ status: 'signed-out' });
          return;
        }
        if (!response.ok) {
          setAccount({ status: 'error', message: 'Account data could not be loaded.' });
          return;
        }
        const data = (await response.json()) as { isPro?: boolean };
        setAccount({ status: 'signed-in', isPro: data.isPro === true });
      })
      .catch(() => {
        setAccount({ status: 'error', message: 'Account data could not be loaded.' });
      });
  }, []);

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch('/api/auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = (await response.json()) as { error?: string; message?: string };
    setMessage(
      response.ok
        ? data.message ?? 'Check your email for a sign-in link.'
        : data.error ?? 'The sign-in link could not be created.'
    );
  }

  async function startCheckout() {
    setMessage(null);
    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      credentials: 'include',
    });
    const data = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !data.url) {
      setMessage(data.error ?? 'Checkout is not available yet.');
      await postUpgradeEvent('checkout_disabled');
      return;
    }
    window.location.href = data.url;
  }

  async function openPortal() {
    setMessage(null);
    const response = await fetch('/api/stripe/portal', {
      method: 'POST',
      credentials: 'include',
    });
    const data = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !data.url) {
      setMessage(data.error ?? 'Billing portal is not available yet.');
      await postUpgradeEvent('portal_failed');
      return;
    }
    window.location.href = data.url;
  }

  return (
    <section className="mt-8 space-y-6">
      {account.status === 'loading' && (
        <p className="text-sm text-neutral-600">Checking account status...</p>
      )}

      {account.status === 'error' && (
        <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {account.message}
        </p>
      )}

      {account.status === 'signed-out' && (
        <form
          onSubmit={requestLink}
          className="rounded-md border border-neutral-200 p-4"
        >
          <h2 className="text-sm font-semibold">Sign in before upgrading</h2>
          <label className="mt-4 flex flex-col gap-1 text-sm">
            <span>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2"
              autoComplete="email"
            />
          </label>
          <button className="mt-4 rounded-md bg-black px-4 py-2 text-sm text-white">
            Send sign-in link
          </button>
        </form>
      )}

      {account.status === 'signed-in' && account.isPro && (
        <div className="rounded-md border border-neutral-200 p-4">
          <h2 className="text-sm font-semibold">Pro account</h2>
          <p className="mt-2 text-sm text-neutral-700">
            Your account already has Pro access.
          </p>
          <button
            className="mt-4 rounded-md bg-black px-4 py-2 text-sm text-white"
            onClick={openPortal}
          >
            Manage billing
          </button>
        </div>
      )}

      {account.status === 'signed-in' && !account.isPro && (
        <div className="rounded-md border border-neutral-200 p-4">
          <h2 className="text-sm font-semibold">Pro checkout</h2>
          <p className="mt-2 text-sm text-neutral-700">
            Checkout remains disabled until Stripe test mode is configured and
            explicitly enabled.
          </p>
          <button
            className="mt-4 rounded-md bg-black px-4 py-2 text-sm text-white"
            onClick={startCheckout}
          >
            Start checkout
          </button>
        </div>
      )}

      {message && <p className="text-sm text-neutral-700">{message}</p>}
      <WaitlistForm />
    </section>
  );
}

async function postUpgradeEvent(eventCode: string) {
  try {
    await fetch('/api/client-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventCode, route: '/upgrade' }),
    });
  } catch {
    // Monitoring is best-effort.
  }
}
