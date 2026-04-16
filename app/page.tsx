import Link from 'next/link';

const bullets = [
  {
    title: 'Files stay in your browser',
    body: 'Your PDFs never leave your browser. All processing happens client-side.',
  },
  {
    title: 'Verified redactions',
    body:
      'Unlike Adobe defaults, we verify your redactions worked. Every export is re-opened and scanned before download.',
  },
  {
    title: 'Works logged-out',
    body: 'No signup required for the free tier. Drop a file, redact, download.',
  },
];

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-4 pt-16 pb-24">
      <section className="max-w-2xl">
        <h1 className="text-5xl font-semibold tracking-tight leading-[1.1]">
          A PDF redactor that proves your redactions worked.
        </h1>
        <p className="mt-6 text-lg text-neutral-600">
          Redact sensitive text in your browser. Files never leave your device.
          Every export is verified before you can download it.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Link
            href="/app"
            className="rounded-md bg-black text-white px-5 py-3 text-sm font-medium"
          >
            Try now — no signup
          </Link>
          <Link href="/pricing" className="text-sm underline underline-offset-4">
            See pricing
          </Link>
        </div>
      </section>

      <section className="mt-24 grid md:grid-cols-3 gap-8">
        {bullets.map((b) => (
          <div key={b.title}>
            <h3 className="font-medium">{b.title}</h3>
            <p className="mt-2 text-sm text-neutral-600">{b.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
