export const metadata = {
  title: 'DPA — OnlineRedactor',
  description:
    'OnlineRedactor data processing posture and DPA availability.',
};

export default function DpaPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Data processing</h1>
      <p className="mt-6 text-neutral-700">
        OnlineRedactor does not currently offer a signed DPA, BAA, or
        enterprise compliance pack. PDF processing stays browser-side with
        public AGPL source while paid checkout remains disabled by default.
      </p>

      <section className="mt-10 space-y-6 text-sm text-neutral-700">
        <div>
          <h2 className="text-lg font-medium text-neutral-950">
            Document processing
          </h2>
          <p className="mt-2">
            Uploaded PDFs, filenames, extracted text, redaction targets, and
            output files are processed locally in your browser and are not sent
            to OnlineRedactor servers.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-medium text-neutral-950">
            Account processing
          </h2>
          <p className="mt-2">
            Account and billing systems are limited to login, plan,
            subscription, waitlist, and content-free usage metadata. They do
            not store PDF bytes, filenames, redaction text, or coordinates.
          </p>
        </div>
      </section>
    </main>
  );
}
