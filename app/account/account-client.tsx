'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

type AccountResponse = {
  user: { email: string };
  plan: string;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
  };
  usageEvents: Array<{
    type: string;
    createdAt: string;
  }>;
  guarantees: {
    storesPdfBytes: boolean;
    storesFilenames: boolean;
    storesRedactionText: boolean;
    storesCoordinates: boolean;
  };
};

type LoadState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; account: AccountResponse }
  | { status: 'error'; message: string };

export function AccountClient() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [devMagicLink, setDevMagicLink] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/account', {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setState({ status: 'signed-out' });
          return;
        }
        if (!response.ok) {
          setState({
            status: 'error',
            message: 'Account data could not be loaded.',
          });
          return;
        }
        setState({
          status: 'signed-in',
          account: (await response.json()) as AccountResponse,
        });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          message: 'Account data could not be loaded.',
        });
      });

    return () => controller.abort();
  }, []);

  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setDevMagicLink(null);
    const response = await fetch('/api/auth/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = (await response.json()) as {
      error?: string;
      message?: string;
      devMagicLink?: string;
    };
    if (!response.ok) {
      setMessage(data.error ?? 'The sign-in link could not be created.');
      return;
    }
    setMessage(data.message ?? 'Check your email for a sign-in link.');
    if (data.devMagicLink) setDevMagicLink(data.devMagicLink);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setState({ status: 'signed-out' });
  }

  async function deleteAccount() {
    const confirmed = window.confirm(
      'Delete this account state? This removes account, profile, subscription, and usage metadata. PDFs are never stored.'
    );
    if (!confirmed) return;
    await fetch('/api/account', { method: 'DELETE', credentials: 'include' });
    setState({ status: 'signed-out' });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Account</h1>
      <p className="mt-4 text-neutral-700">
        Account data is limited to login, plan, subscription, and content-free
        usage metadata. PDF bytes, filenames, redaction text, and coordinates
        are not sent to this account system.
      </p>

      {state.status === 'loading' && (
        <p className="mt-8 text-sm text-neutral-600">Loading account...</p>
      )}

      {state.status === 'error' && (
        <p role="alert" className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {state.message}
        </p>
      )}

      {state.status === 'signed-out' && (
        <form
          onSubmit={requestLink}
          className="mt-8 rounded-md border border-neutral-200 p-4"
        >
          <h2 className="text-sm font-semibold">Sign in with email</h2>
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
          {message && <p className="mt-3 text-sm text-neutral-700">{message}</p>}
          {devMagicLink && (
            <p className="mt-3 text-sm">
              <a className="underline underline-offset-4" href={devMagicLink}>
                Development sign-in link
              </a>
            </p>
          )}
        </form>
      )}

      {state.status === 'signed-in' && (
        <section className="mt-8 space-y-4">
          <div className="rounded-md border border-neutral-200 p-4">
            <h2 className="text-sm font-semibold">Plan</h2>
            <p className="mt-2 text-sm text-neutral-700">
              Signed in as {state.account.user.email}
            </p>
            <p className="mt-1 text-sm text-neutral-700">
              Plan: {state.account.plan}. Subscription status:{' '}
              {state.account.subscription.status}.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/upgrade"
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm"
              >
                Billing portal
              </Link>
              <button
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm"
                onClick={logout}
              >
                Sign out
              </button>
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 p-4">
            <h2 className="text-sm font-semibold">Usage history</h2>
            {state.account.usageEvents.length === 0 ? (
              <p className="mt-2 text-sm text-neutral-700">
                No account usage events yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                {state.account.usageEvents.map((event) => (
                  <li key={`${event.type}-${event.createdAt}`}>
                    {event.type} at {new Date(event.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-md border border-neutral-200 p-4">
            <h2 className="text-sm font-semibold">Storage boundary</h2>
            <ul className="mt-2 space-y-1 text-sm text-neutral-700">
              <li>PDF bytes stored: {String(state.account.guarantees.storesPdfBytes)}</li>
              <li>Filenames stored: {String(state.account.guarantees.storesFilenames)}</li>
              <li>
                Redaction text stored:{' '}
                {String(state.account.guarantees.storesRedactionText)}
              </li>
              <li>
                Coordinates stored: {String(state.account.guarantees.storesCoordinates)}
              </li>
            </ul>
          </div>

          <button
            className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700"
            onClick={deleteAccount}
          >
            Delete account
          </button>
        </section>
      )}
    </main>
  );
}
