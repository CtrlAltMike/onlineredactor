# Launch Checklist

Checkout must stay disabled until every item in this checklist is complete.

## Automated Gate

Run:

```bash
npm run launch-check
```

For deployed endpoint smoke tests, run:

```bash
LAUNCH_SMOKE_URL=https://onlineredactor.pages.dev npm run launch-check
```

The script verifies lint, unit tests, production build, fixture generation,
Playwright fixture flows, remote D1 migration status, GitHub public visibility,
and optional deployed API smoke tests.

## Manual Gate

- Cloudflare Email Service sender/domain is configured.
- Stripe test product, price, webhook secret, and portal are configured.
- Stripe test checkout, renewal, cancellation, failed payment, and portal flows
  update D1 correctly.
- Manual QA in Chrome, macOS Preview, and Adobe Reader confirms no copy/paste
  leaks for supported fixtures.
- Legal review confirms AGPL/public-source posture or a commercial MuPDF
  license is in place.
- `STRIPE_CHECKOUT_ENABLED=true` is set only after the test-mode gate passes.
- `STRIPE_LIVE_MODE_ALLOWED=true` is set only for an intentional live-mode
  launch.

## Logging Rules

No logs or events may include PDF bytes, filenames, extracted PDF text,
redaction target strings, redaction coordinates, or arbitrary document-derived
error messages.
