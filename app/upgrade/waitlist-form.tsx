'use client';

import { FormEvent, useState } from 'react';

export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function joinWaitlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source: 'upgrade' }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? 'The waitlist request could not be saved.');
      return;
    }
    setEmail('');
    setMessage('You are on the Pro waitlist.');
  }

  return (
    <form
      onSubmit={joinWaitlist}
      className="mt-8 rounded-md border border-neutral-200 p-4"
    >
      <h2 className="text-sm font-semibold">Join the Pro waitlist</h2>
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
        Join waitlist
      </button>
      {message && <p className="mt-3 text-sm text-neutral-700">{message}</p>}
    </form>
  );
}
