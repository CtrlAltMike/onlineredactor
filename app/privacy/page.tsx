const schema = `public.profiles (
  id uuid primary key,
  stripe_customer_id text unique,
  plan text not null default 'free',
  subscription_status text,
  current_period_end timestamptz,
  daily_usage_count int not null default 0,
  daily_usage_date date,
  created_at timestamptz default now()
)

public.usage_events (
  id bigint primary key,
  user_id uuid,
  occurred_at timestamptz,
  page_count int,
  mode text
)

public.stripe_events (
  id text primary key,
  type text,
  received_at timestamptz
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
        JavaScript. Our servers handle only authentication, billing, and
        subscription state — never the documents you upload.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-medium">Here is literally every column we have about you</h2>
        <p className="mt-2 text-sm text-neutral-600">
          This is the complete database schema for your account. Nothing
          related to your documents is stored server-side.
        </p>
        <pre className="mt-4 rounded-md bg-neutral-100 p-4 text-xs overflow-x-auto">
          {schema}
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-medium">Never stored, server-side or client-side, on any of our systems</h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-700">
          {neverStored.map((x) => (
            <li key={x} className="flex gap-2">
              <span aria-hidden>·</span>
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
