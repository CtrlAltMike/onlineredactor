import { WaitlistForm } from './waitlist-form';

export const metadata = {
  title: 'Upgrade — OnlineRedactor',
  description: 'OnlineRedactor paid checkout is paused.',
};

export default function UpgradePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 pt-16 pb-24">
      <h1 className="text-4xl font-semibold tracking-tight">Upgrade</h1>
      <p className="mt-6 text-neutral-700">
        Paid checkout is paused while we complete the redaction safety review
        and keep the app aligned with its AGPL license obligations.
      </p>
      <p className="mt-8 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
        The free redaction tool remains available with a local 3-redaction
        daily cap, saved local rules, and content-free local history. We are not
        accepting paid subscriptions at this time.
      </p>
      <WaitlistForm />
    </main>
  );
}
