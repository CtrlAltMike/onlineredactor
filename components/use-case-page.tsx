import Link from 'next/link';

type UseCasePageProps = {
  title: string;
  intro: string;
  steps: string[];
  notes: string[];
};

export function UseCasePage({
  title,
  intro,
  steps,
  notes,
}: UseCasePageProps) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <section className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-5 text-lg text-neutral-600">{intro}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/app"
            className="rounded-md bg-black px-5 py-3 text-sm font-medium text-white"
          >
            Open redactor
          </Link>
          <Link
            href="/security"
            className="rounded-md border border-neutral-300 px-5 py-3 text-sm"
          >
            Read security details
          </Link>
        </div>
      </section>

      <section className="mt-14 grid gap-10 md:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="text-xl font-semibold">Workflow</h2>
          <ol className="mt-5 space-y-4 text-sm text-neutral-700">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="font-medium text-neutral-950">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="text-xl font-semibold">What V1 verifies</h2>
          <ul className="mt-5 space-y-4 text-sm text-neutral-700">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
