import Link from 'next/link';

type Tier = {
  name: string;
  price: string;
  blurb: string;
  features: string[];
  cta: { label: string; href: string };
};

const tiers: Tier[] = [
  {
    name: 'Consumer',
    price: 'Free',
    blurb: 'For occasional redactions. No signup required.',
    features: [
      'Manual redaction, text search, auto-detect',
      '3 verified redactions per local day',
      'Saved local rules + content-free history',
      'Watermarked redaction certificate',
    ],
    cta: { label: 'Open the tool', href: '/app' },
  },
  {
    name: 'Prosumer',
    price: '$7/mo',
    blurb: 'For freelancers, paralegals, solo HR, journalists.',
    features: [
      'Unlimited redactions',
      'Batch mode (drop folder)',
      'Clean redaction certificate',
      'Account-synced rules + history',
    ],
    cta: { label: 'Paused', href: '/upgrade' },
  },
  {
    name: 'Enterprise',
    price: 'From $15/seat',
    blurb: 'For legal, healthcare, HR teams that need audit and SSO.',
    features: [
      'Team admin + SSO',
      'Customer-owned audit log sync',
      'HIPAA BAA + DPA',
      'Priority support + SLA',
    ],
    cta: { label: 'Contact us', href: 'mailto:sales@onlineredactor.com' },
  },
];

export default function PricingPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 pt-16 pb-24">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-4 text-neutral-600">
          Our free tier cap is on the honor system — we would rather you
          upgrade because the product is worth it, not because we fingerprint
          you.
        </p>
      </header>

      <section className="mt-12 grid md:grid-cols-3 gap-6">
        {tiers.map((t) => (
          <div
            key={t.name}
            className="rounded-lg border border-neutral-200 p-6 flex flex-col"
          >
            <h2 className="text-lg font-medium">{t.name}</h2>
            <p className="mt-1 text-2xl font-semibold">{t.price}</p>
            <p className="mt-2 text-sm text-neutral-600">{t.blurb}</p>
            <ul className="mt-6 space-y-2 text-sm flex-1">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden>·</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={t.cta.href}
              className="mt-6 rounded-md bg-black text-white text-center px-4 py-2 text-sm"
            >
              {t.cta.label}
            </Link>
          </div>
        ))}
      </section>
    </main>
  );
}
