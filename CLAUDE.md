# OnlineRedactor — Project Guide

## What this is

A privacy-first, client-side PDF redactor. Core product commitment: **the PDF never leaves the user's browser.** All redaction happens in-page via PDF.js + pdf-lib. Server handles only auth, billing, and subscription state.

Primary domain: `onlineredactor.com`. Related domains (`onlineredactor.net`, `onlineredaction.com`) 301 to primary.

Target MVP user: general prosumers / small business searching "redact PDF online". Paid tiers: Prosumer (~$7/mo) and Enterprise (~$15–25/seat, deferred to v2).

For the full validated design, read `docs/plans/2026-04-16-onlineredactor-design.md` before making architectural decisions.

## Non-negotiables

- **Client-side only for document processing.** No endpoint ever receives PDF bytes, filenames with PII, redaction coordinates, or extracted text. Violating this breaks the product's trust story — and the pricing page, and the privacy page, and the launch pitch.
- **Automated post-redaction verification.** After applying redactions, re-open the output with PDF.js, extract text, assert redacted strings are absent. If this check fails, hard-fail the export. This is the product's primary differentiator.
- **Free tier cap is a nudge, not DRM.** LocalStorage counter for anonymous, server-synced for signed-in free users. No IP rate limits, no browser fingerprinting, no CAPTCHA gates.
- **Magic-link auth only (Supabase).** No password UX, no OAuth in MVP. Account only forced at Pro upgrade.
- **Stripe Checkout + Billing Portal (hosted).** Do not build payment UI.

## Marketing copy (apply when writing landing / pricing / privacy / launch copy)

- Lead feature: "Unlike Adobe defaults, we verify your redactions worked."
- Landing bullet: "Works logged-out" (competitors require signup before upload).
- Pricing honesty line: "Our free tier cap is on the honor system — we'd rather you upgrade because the product is worth it, not because we fingerprint you."
- Privacy page: publish the full database schema verbatim. Frame it as "Here's literally every column we have about you."
- Launch headline candidate: "A PDF redactor that proves your redactions worked."

## Deferred UX copy (use when building the relevant flow)

- Scanned/image-only PDF detected (no extractable text): "This PDF appears to be scanned. OCR redaction is coming soon. [Notify me]" — wires to `/api/waitlist`.

## Deferred features (explicitly out of v1 — do not build without revisiting design)

- **OCR redaction** for scanned PDFs (v1.1). Deferred due to Tesseract WASM bundle weight (~10MB) and complexity.
- **Server-side API** for automation. Deferred because it breaks the client-side trust story; if we build it, it ships as a separately-branded product with an explicit "files touch our server, deleted after 60s" tradeoff.
- **Enterprise tier** — SSO (SAML/Okta/Google Workspace), team admin console, org-wide saved rulesets, customer-cloud audit log sync (S3/SharePoint/GCS), HIPAA BAA / DPA / compliance pack, priority SLA, self-hosted / air-gapped deploy. Schema reserves `organizations`, `org_members`, `saved_rulesets` but v1 does not create them. Build when the first real inbound lead asks.
- **Open-source redaction verifier** (v1.1). A small standalone tool, linked from `/privacy`, that any user can run to independently confirm the output is clean. Marketing moat.
- **Blog content** at `/blog/*`. Route reserved; posts deferred.

## Stack (decided)

- Next.js (App Router) on Vercel — SSG for marketing, client-only `/app` route
- Supabase (auth + Postgres + RLS) — free tier
- Stripe Checkout + Webhook — test mode until launch
- PDF.js (render), pdf-lib (manipulate + flatten)
- Vitest + React Testing Library (unit/component), Playwright (integration/E2E)
- Sentry (client errors, scrubbed — no PDF bytes, no filenames in breadcrumbs)

## Working norms

- Capture actionable asides (marketing copy, UX microcopy, deferred features, naming) into this file under the right section as they come up in conversation. Do not rely on memory/chat context alone — sessions end and context compacts.
- Before shipping any change that touches the redaction pipeline, run the `verify-redaction` Playwright suite against the full fixture corpus. That suite is the product guarantee.
- Privacy and trust copy is load-bearing marketing, not legal boilerplate. Edit it with the same care as the code.
