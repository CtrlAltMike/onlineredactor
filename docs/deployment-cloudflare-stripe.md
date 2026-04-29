# Cloudflare and Stripe deployment

OnlineRedactor currently runs its PDF redaction flow entirely in the browser.
That makes the first production deployment a static Next.js export on
Cloudflare Pages, with Stripe-hosted Payment Links for checkout.

## Current deploy target

- Host: Cloudflare Pages
- Build command: `npm run build:cloudflare`
- Build output directory: `out`
- Stripe integration: Payment Link URL compiled into the pricing page
- Required Cloudflare build variable:
  - `NEXT_PUBLIC_STRIPE_PROSUMER_PAYMENT_LINK`

Cloudflare's static Next.js Pages guide uses `npx next build` and `out` for
static exports. Cloudflare's current recommendation for full-stack Next.js is
Workers with OpenNext, but this app does not need a server for the current
browser-only redaction flow.

References:

- Cloudflare static Next.js Pages guide:
  https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/
- Cloudflare Next.js Workers guide:
  https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Stripe Payment Links:
  https://docs.stripe.com/payment-links

## Stripe setup

1. In Stripe, create the Prosumer product and a recurring monthly price.
2. Create a Payment Link for that subscription.
3. Set the Payment Link's success URL to your production app, for example
   `https://onlineredactor.com/app?checkout=success`.
4. In Cloudflare Pages, add
   `NEXT_PUBLIC_STRIPE_PROSUMER_PAYMENT_LINK` with that Stripe Payment Link URL.
5. Redeploy the site so `/pricing` points the Prosumer upgrade button at
   Stripe.

This intentionally avoids collecting card data inside OnlineRedactor. Stripe
hosts the payment page and handles payment method collection.

## Cloudflare Pages setup

1. Push the repository to GitHub.
2. In Cloudflare, create a Pages project from the repository.
3. Use these build settings:
   - Framework preset: Next.js (Static HTML Export)
   - Build command: `npm run build:cloudflare`
   - Build output directory: `out`
4. Add the Stripe build variable above.
5. Deploy and attach the custom domain.

## Later paid access enforcement

Payment Links are enough to collect payment, but they do not prove subscription
status inside the app by themselves. When the product needs accounts, a billing
portal, seat management, or server-side usage enforcement, move the deployment
to Cloudflare Workers with OpenNext and add:

- A Stripe Checkout Sessions endpoint for subscription checkout.
- A Stripe Billing Portal endpoint for subscription management.
- A Stripe webhook endpoint that verifies signatures from the raw request body.
- Cloudflare D1 tables for users, subscription status, and processed Stripe
  event IDs.
- Auth that stores only account and billing state, never PDF bytes or redaction
  coordinates.

That future Worker setup can still keep PDF processing fully client-side.
