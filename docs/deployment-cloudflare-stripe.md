# Cloudflare and Stripe deployment

OnlineRedactor currently runs its PDF redaction flow entirely in the browser.
That makes the first production deployment a static Next.js export on
Cloudflare Pages.

Paid checkout is intentionally paused while redaction safety and AGPL compliance
work is completed. Do not re-enable Stripe checkout until the redaction review
items are resolved.

## Current deploy target

- Host: Cloudflare Pages
- Build command: `npm run build:cloudflare`
- Build output directory: `out`
- Stripe integration: test-mode endpoints available, checkout disabled by
  default

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

Stripe checkout is gated by `STRIPE_CHECKOUT_ENABLED=false` by default. Any old
direct Payment Link should remain inactive or unlinked from the app.

When paid plans are enabled later:

1. In Stripe, create the Prosumer product and a recurring monthly price.
2. Configure the Stripe customer portal.
3. Add Cloudflare secrets: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
4. Add the non-secret Pages variables `STRIPE_PRO_PRICE_ID` and
   `STRIPE_CHECKOUT_ENABLED=true`.
5. Keep `STRIPE_LIVE_MODE_ALLOWED` unset unless intentionally switching from
   test mode to live mode.

This intentionally avoids collecting card data inside OnlineRedactor. Stripe
hosts Checkout and the Billing Portal.

## Cloudflare Pages setup

1. Push the repository to GitHub.
2. In Cloudflare, create a Pages project from the repository.
3. Use these build settings:
   - Framework preset: Next.js (Static HTML Export)
   - Build command: `npm run build:cloudflare`
   - Build output directory: `out`
4. Deploy and attach the custom domain.

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
