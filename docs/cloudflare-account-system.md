# Cloudflare Account System

Phase 4 uses Cloudflare without storing document content.

## Data Boundary

The D1 schema stores only:

- email login state
- profile metadata
- subscription metadata
- content-free usage events
- Stripe event ids and payload hashes for future webhook idempotency
- waitlist emails

It does not include fields for PDF bytes, filenames, redaction text, or
redaction coordinates.

## D1

Production database:

- name: `onlineredactor-prod`
- binding: `DB`
- migration: `migrations/0001_phase4_accounts.sql`

Apply migrations with:

```bash
npx wrangler d1 migrations apply onlineredactor-prod --remote
```

## Magic-Link Email

The app supports an optional Cloudflare Email Service-compatible binding named
`EMAIL`. Cloudflare Pages rejected `send_email` in `wrangler.jsonc` during
deployment validation on April 30, 2026, so production must stay in the
"sign-in email is not configured yet" state until the app is moved to a
compatible Workers runtime or Cloudflare adds Pages support for this binding.

When the runtime supports it, configure:

- binding: `EMAIL`
- variable: `AUTH_EMAIL_FROM`, for example `login@yourdomain.com`
- variable: `APP_BASE_URL`, for example `https://onlineredactor.pages.dev`

The sender domain must be configured for Cloudflare Email Service. Without the
binding and sender variable, `/api/auth/request` will save the address but will
truthfully report that sign-in email is not configured yet.

Do not enable `AUTH_DEV_SHOW_MAGIC_LINK=true` in production. It is only for local
or private preview testing because it returns the sign-in link in the browser.

## Endpoints

- `POST /api/auth/request`
- `GET /api/auth/verify?token=...`
- `POST /api/auth/logout`
- `GET /api/account`
- `DELETE /api/account`
- `POST /api/waitlist`
