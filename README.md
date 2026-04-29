# OnlineRedactor

Client-side PDF redaction built with Next.js. Uploaded PDFs are rendered,
redacted, and verified in the browser; document bytes are not sent to the app's
servers.

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
- Stripe build variable: `NEXT_PUBLIC_STRIPE_PROSUMER_PAYMENT_LINK`

Create the Prosumer subscription Payment Link in Stripe, then set the variable
in Cloudflare Pages and redeploy. See
[`docs/deployment-cloudflare-stripe.md`](docs/deployment-cloudflare-stripe.md)
for the full deployment notes and the future Workers path for webhooks and
subscription enforcement.
