const schema = `users (
  id text primary key,
  email text not null unique,
  created_at text not null,
  updated_at text not null,
  deleted_at text
)

profiles (
  user_id text primary key,
  display_name text,
  created_at text not null,
  updated_at text not null
)

subscriptions (
  user_id text primary key,
  plan text not null default 'free',
  status text not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end text,
  created_at text not null,
  updated_at text not null
)

usage_events (
  id text primary key,
  user_id text not null,
  event_type text not null,
  created_at text not null,
  metadata_json text not null default '{}'
)

stripe_events (
  id text primary key,
  stripe_event_id text not null unique,
  type text not null,
  payload_sha256 text not null,
  processed_at text not null
)

waitlist (
  id text primary key,
  email text not null unique,
  source text not null default 'upgrade',
  created_at text not null
)

auth_tokens (
  id text primary key,
  user_id text not null,
  token_hash text not null unique,
  created_at text not null,
  expires_at text not null,
  used_at text
)

sessions (
  id text primary key,
  user_id text not null,
  session_hash text not null unique,
  created_at text not null,
  expires_at text not null,
  revoked_at text
)

client_events (
  id text primary key,
  user_id text,
  event_code text not null,
  route text not null,
  created_at text not null
)`;

const neverStored = [
  'PDF bytes',
  'Filenames containing personal information',
  'Redaction coordinates or targets',
  'Extracted or redacted text',
  'IP addresses',
  'User agents',
  'Device fingerprints',
];

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 pt-16 pb-24">
      <h1 className="text-4xl font-semibold tracking-tight">Privacy</h1>

      <p className="mt-6 text-neutral-700">
        Your files never leave your browser. Rendering, text extraction,
        redaction, and verification all run in-page using WebAssembly and
        JavaScript. Our servers handle authentication, billing, waitlist, and
        content-free monitoring state, never the documents you upload.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-medium">Server-side account schema</h2>
        <p className="mt-2 text-sm text-neutral-600">
          This is the current Cloudflare D1 schema used by account, waitlist,
          billing, session, and content-free monitoring features. Nothing
          related to your PDF contents is stored server-side.
        </p>
        <pre className="mt-4 rounded-md bg-neutral-100 p-4 text-xs overflow-x-auto">
          {schema}
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-medium">Never sent to or stored on OnlineRedactor servers</h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-700">
          {neverStored.map((x) => (
            <li key={x} className="flex gap-2">
              <span aria-hidden>·</span>
              <span>{x}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-neutral-600">
          Saved rules and export history, if used, stay in this browser. Saved
          rules may contain text you choose to search for; local history stores
          only content-free proof details such as output hash, page count, and
          region count.
        </p>
      </section>
    </main>
  );
}
