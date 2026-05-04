# OnlineRedactor

Client-side PDF redaction built with Next.js. Supported PDFs are rendered,
redacted, metadata-stripped, and checked in the browser; document bytes are not
sent to the app's servers.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Checks

```bash
npm test
npm run build
```

The build copies PDF.js standard fonts into `public/pdfjs-standard-fonts` before
running Next.js.

## Cloudflare deployment

This app is configured as a static Next.js export for Cloudflare Pages.

- Build command: `npm run build:cloudflare`
- Output directory: `out`
- Account API data: Cloudflare D1 database `onlineredactor-prod`
- Email login: API support exists, but Cloudflare Pages does not accept a
  `send_email` binding in `wrangler.jsonc`; production stays honest until email
  is configured through a compatible Cloudflare runtime.
- Stripe: API endpoints are present but checkout is disabled by default with
  `STRIPE_CHECKOUT_ENABLED=false`

Paid checkout is intentionally paused while redaction safety and AGPL compliance
work is completed. See
[`docs/deployment-cloudflare-stripe.md`](docs/deployment-cloudflare-stripe.md)
for the deployment notes and the future Workers path for webhooks and
subscription enforcement if paid plans are re-enabled later.

See [`docs/cloudflare-account-system.md`](docs/cloudflare-account-system.md) for
the account-system setup and manual Email Service steps.
See [`docs/launch-checklist.md`](docs/launch-checklist.md) for the V1 launch
gate.
