export const metadata = {
  title: 'Terms — OnlineRedactor',
  description:
    'Terms for using OnlineRedactor as an AGPL browser-based PDF redaction tool.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Terms</h1>
      <p className="mt-6 text-neutral-700">
        OnlineRedactor is an AGPL-licensed browser tool. You are
        responsible for reviewing the output before sharing it and for deciding
        whether the tool is appropriate for your legal, business, healthcare,
        or compliance needs.
      </p>

      <section className="mt-10 space-y-6 text-sm text-neutral-700">
        <div>
          <h2 className="text-lg font-medium text-neutral-950">No paid service</h2>
          <p className="mt-2">
            Paid checkout is disabled by default until Stripe test mode passes
            and the operator enables it. No service-level agreement, business
            associate agreement, or professional-services relationship is
            created by using the site.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-medium text-neutral-950">No legal advice</h2>
          <p className="mt-2">
            OnlineRedactor is software, not legal, compliance, or security
            advice. Consult qualified counsel or compliance staff for regulated
            workflows.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-medium text-neutral-950">Use limits</h2>
          <p className="mt-2">
            The free cap is a local browser counter. Do not use the app to
            process unlawful material, attack the service, or misrepresent a
            verification certificate.
          </p>
        </div>
      </section>
    </main>
  );
}
