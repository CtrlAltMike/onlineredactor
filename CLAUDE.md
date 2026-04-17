# OnlineRedactor — Project Guide

## What this is

A privacy-first, client-side PDF redactor with **true content-stream redaction**, not overlay rectangles. Core product commitment: **the PDF never leaves the user's browser.** All redaction, text extraction, and post-redaction verification run in-page.

Primary domain: `onlineredactor.com`. Related domains (`onlineredactor.net`, `onlineredaction.com`) 301 to primary.

Target MVP user: general prosumers / small business searching "redact PDF online". Paid tiers: Prosumer (~$7/mo) and Enterprise (~$15–25/seat, deferred to v2).

For the full validated design, read `docs/plans/2026-04-16-onlineredactor-design.md`. Note: the design doc predates the MuPDF pivot (see "Redaction engine" below) — `lib/pdf/apply.ts` is implemented against MuPDF, not pdf-lib's `drawRectangle`.

## License and source availability

This project is **AGPL-3.0-or-later**. The full source is public at `https://github.com/CtrlAltMike/onlineredactor`. The footer of every page links to the source. AGPL §13 is not just something we comply with — it's load-bearing marketing: the same trust story that publishes the DB schema verbatim ("here's every column we have about you") extends to "here's every line of code too."

We chose AGPL because MuPDF (our redaction engine) is AGPL / commercial dual-licensed, and we are not paying Artifex's commercial license — both because the upfront cost breaks the bootstrap premise and because open-sourcing the whole app *reinforces* the privacy brand instead of undermining it.

## Redaction engine — the most important paragraph in this file

**MuPDF is the redaction engine.** `pdf-lib`'s `drawRectangle` only overlays a black rectangle; it does not remove underlying text or image objects, so the redacted text remains copyable from the exported PDF. This is the exact bug that has gotten competitors sued. Under no circumstances should `lib/pdf/apply.ts` ever regress back to an overlay-only implementation.

MuPDF exposes `PDFAnnotation.applyRedaction(...)` and `PDFPage.applyRedactions(...)` which rewrite the content stream: text-showing operators (`Tj`/`TJ`/`'`/`"`) intersecting the target quad are dropped or split, images intersecting are masked or removed per `imageMethod`, and the opaque black rectangle is drawn. PDF.js is kept for rendering (display-side) and verification (re-extraction post-redaction).

**`verify-redaction` Playwright spec is the gate.** Apply → save → re-open with PDF.js → extract text → assert no redacted string survives. If this test fails on any fixture, we do not ship. It is the product's guarantee made executable.

## Non-negotiables

- **Client-side only for document processing.** No endpoint ever receives PDF bytes, filenames with PII, redaction coordinates, or extracted text. Violating this breaks the product's trust story — and the pricing page, and the privacy page, and the launch pitch.
- **True content-stream redaction.** Use MuPDF. Never regress to overlay-only.
- **Automated post-redaction verification on every export.** Extract text from the output via PDF.js and assert all target strings are absent. In manual-draw mode, seed the target list by extracting text *under the box* before apply. If verification fails, hard-fail the export with a clear error. Never download silently on `ok: false`.
- **Free tier cap is a nudge, not DRM.** LocalStorage counter for anonymous, server-synced for signed-in free users. No IP rate limits, no browser fingerprinting, no CAPTCHA gates.
- **Magic-link auth only (Supabase).** No password UX, no OAuth in MVP. Account only forced at Pro upgrade.
- **Stripe Checkout + Billing Portal (hosted).** Do not build payment UI.
- **Source repo stays public** once the first deploy exists. AGPL compliance + brand.

## Marketing copy (apply when writing landing / pricing / privacy / launch)

### Core trust claims
- Lead feature: "Unlike Adobe defaults, we verify your redactions worked."
- Landing bullet: "Works logged-out" (competitors require signup before upload).
- Pricing honesty line: "Our free tier cap is on the honor system — we would rather you upgrade because the product is worth it, not because we fingerprint you."
- Privacy page: publish the full database schema verbatim. Frame it as "Here is literally every column we have about you."
- Launch headline candidate: "A PDF redactor that proves your redactions worked."

### MuPDF / open-source credibility (new, post-pivot)
- Engine provenance: "Redaction powered by MuPDF — the same engine behind Ghostscript. Battle-tested on tens of millions of PDFs."
- Attack-class immunity: "Our engine handles font glyph positioning correctly. We are not vulnerable to the redaction bypass documented in *Story Beyond the Eye: Glyph Positions Break PDF Text Redaction* ([arxiv.org/abs/2206.02285](https://arxiv.org/abs/2206.02285))."
- Open-source reinforcement: "Our servers never see your PDF. Every line of that claim is open-source — read it yourself at github.com/CtrlAltMike/onlineredactor."
- Trust-ladder tagline: "We publish our database schema. We open-source our code. We re-verify every redaction before you can download it. If you still don't trust us, you shouldn't — use the tool anyway, because your file never leaves your browser."
- Pricing-page AGPL note (for the Consumer tier): "Free forever, AGPL-licensed — because privacy-preserving software should not be a subscription."

### Technical marketing (the "why us not Adobe" page)
- "Adobe's default redaction exports a PDF where the 'redacted' text is still copy-pasteable. This is a well-documented problem. Our exports go through content-stream rewriting, not overlay rectangles, then a second-pass PDF.js text extraction to prove the target strings are gone."
- "We use the MuPDF algorithm because we trust Artifex's engineers more than we trust ourselves. We wrote the glue; they wrote the engine."

## Deferred UX copy (use when building the relevant flow)

- Scanned/image-only PDF detected (no extractable text): "This PDF appears to be scanned. OCR redaction is coming soon. [Notify me]" — wires to `/api/waitlist`.
- Verification failure toast: "We caught a problem: '{leaked_string}' is still present in the redacted output. The file was not downloaded. Please report this at github.com/CtrlAltMike/onlineredactor/issues."

## Deferred features (explicitly out of v1 — do not build without revisiting design)

- **OCR redaction** for scanned PDFs (v1.1). Deferred due to Tesseract WASM bundle weight (~10MB) and complexity.
- **Server-side API** for automation. Deferred because it breaks the client-side trust story; if we build it, it ships as a separately-branded product with an explicit "files touch our server, deleted after 60s" tradeoff.
- **Enterprise tier** — SSO (SAML/Okta/Google Workspace), team admin console, org-wide saved rulesets, customer-cloud audit log sync (S3/SharePoint/GCS), HIPAA BAA / DPA / compliance pack, priority SLA, self-hosted / air-gapped deploy. Schema reserves `organizations`, `org_members`, `saved_rulesets` but v1 does not create them. Build when the first real inbound lead asks.
- **Standalone open-source redaction verifier** (previously v1.1). Obviated by making the entire app AGPL: the whole app is the verifier, and it ships with verification built into every export. Skip.
- **Blog content** at `/blog/*`. Route reserved; posts deferred.

## Stack (decided)

- Next.js 16 (App Router) on Vercel — SSG for marketing, client-only `/app` route
- Supabase (auth + Postgres + RLS) — free tier
- Stripe Checkout + Webhook — test mode until launch
- **MuPDF (`mupdf` npm, AGPL)** — redaction engine, runs entirely in browser via WASM
- PDF.js (`pdfjs-dist`) — page rendering + post-redaction text extraction for verification
- `pdf-lib` — retained for fixture generation in tests only; NOT used in the redaction pipeline
- Vitest + React Testing Library (unit/component), Playwright (integration/E2E)
- Sentry (client errors, scrubbed — no PDF bytes, no filenames in breadcrumbs)

## Working norms

- **Verify and reverify on load-bearing decisions.** Don't ship guarantees on single-source confidence. For risk-carrying choices (product trust, licensing, customer-harm exposure), cross-check the claim end-to-end before committing. A green unit test says nothing about whether the product guarantee holds; always include a round-trip regression test that imitates what a user (or an attacker) would actually do.
- Capture actionable asides (marketing copy, UX microcopy, deferred features, naming) into this file under the right section as they come up in conversation. Do not rely on memory/chat context alone.
- Before shipping any change that touches the redaction pipeline, run the `verify-redaction` Playwright suite against the full fixture corpus. That suite is the product guarantee.
- Privacy and trust copy is load-bearing marketing, not legal boilerplate. Edit it with the same care as the code.
- When a reviewer says "I reproduced the failure end-to-end," treat it as Critical. Not as an edge case.
