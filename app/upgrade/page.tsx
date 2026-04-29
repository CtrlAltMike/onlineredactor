const prosumerCheckoutHref = process.env.NEXT_PUBLIC_STRIPE_PROSUMER_PAYMENT_LINK;

export const metadata = {
  title: 'Upgrade — OnlineRedactor',
  description: 'Upgrade OnlineRedactor with Stripe-hosted checkout.',
};

export default function UpgradePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 pt-16 pb-24">
      <h1 className="text-4xl font-semibold tracking-tight">Upgrade</h1>
      <p className="mt-6 text-neutral-700">
        Prosumer checkout is handled by Stripe. Your payment details are entered
        on Stripe&apos;s hosted checkout page, not in OnlineRedactor.
      </p>

      {prosumerCheckoutHref ? (
        <a
          href={prosumerCheckoutHref}
          className="mt-8 inline-flex rounded-md bg-black text-white px-5 py-3 text-sm font-medium"
        >
          Continue to Stripe
        </a>
      ) : (
        <p className="mt-8 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          Checkout is not configured yet. Set
          NEXT_PUBLIC_STRIPE_PROSUMER_PAYMENT_LINK in Cloudflare after creating
          the Prosumer subscription Payment Link in Stripe.
        </p>
      )}
    </main>
  );
}
