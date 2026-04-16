# OnlineRedactor — Design Document

**Date:** 2026-04-16
**Status:** Validated — ready for implementation planning
**Primary domain:** onlineredactor.com

## Goals

Ship a privacy-first, client-side PDF redactor that pursues three reinforcing outcomes:

1. **Revenue** — reach $1–3k MRR within 6 months via freemium conversion.
2. **Traffic** — rank on "redact PDF online" and long-tail variants; SEO is the acquisition engine.
3. **Defensible product** — true client-side processing plus automated post-redaction verification as a technical and marketing moat.

## Target user (MVP)

General prosumers and small-business users searching for an online PDF redactor ("I need to black out my SSN before emailing this"). Highest top-of-funnel volume, easiest SEO win, lowest per-user revenue but highest conversion volume. Privacy-sensitive professionals (legal, healthcare, HR) are the upsell tier, not the initial target.

## Pricing & tiers

### Consumer — Free

- Full features (manual redaction + text search + auto-detect patterns)
- Capped at 3 redactions per 24h; cool-off after
- Watermark on the free redaction certificate ("Redacted with OnlineRedactor — upgrade to remove")
- No account required. Goal: SEO top-of-funnel, viral via the watermark.

### Prosumer — ~$7/mo or $49/yr

- Unlimited redactions
- Batch mode (drop folder, apply rules across all files)
- Clean (unwatermarked) redaction certificate
- Local redaction history + custom saved rules ("my SSN pattern," "my case number format")
- Goal: freelancers, paralegals, solo HR, independent journalists.

### Enterprise — $15–25/seat/mo, 5-seat minimum (deferred to v2)

- Everything in Prosumer, plus:
- Team admin console (seat management, org-wide saved rulesets)
- SSO (SAML / Okta / Google Workspace)
- Audit trail — signed, exportable logs, client-generated, synced to customer-owned cloud (S3 / SharePoint / GCS). Preserves the "files never touch our server" promise.
- Compliance pack — HIPAA BAA, DPA, prewritten security questionnaire answers
- Priority support + SLA
- Optional self-hosted / air-gapped deploy (premium pricing)
- Goal: 3-seat law firms through mid-market legal/healthcare/HR.

Schema reserves `organizations`, `org_members`, `saved_rulesets` tables for v2. Enterprise ships when the first real inbound lead asks.

## MVP scope (v1 = Free + Prosumer)

Ships free tier and paid Prosumer together. Anonymous users can use the tool without an account; account is only required at Pro upgrade. Enterprise and OCR are explicitly out of scope.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   User's Browser                        │
│  ┌────────────┐    ┌──────────────┐    ┌────────────┐   │
│  │ PDF.js     │───▶│ Redaction    │───▶│ pdf-lib    │   │
│  │ (render)   │    │ Engine       │    │ (output)   │   │
│  └────────────┘    │ (pure JS)    │    └────────────┘   │
│                    └──────┬───────┘                     │
│                           │                             │
│                    ┌──────▼───────┐                     │
│                    │ LocalStorage │  (cap counter,      │
│                    │              │   saved rules)      │
│                    └──────────────┘                     │
└──────────────┬──────────────────────────────────────────┘
               │ (only: auth, billing, sub status)
               ▼
┌──────────────────────────────────────────────────────┐
│         Next.js on Vercel (edge + serverless)        │
│  /api/auth/*  /api/stripe/*  /api/usage/verify       │
└──────────────┬───────────────────────────────────────┘
               │
     ┌─────────┴──────────┐
     ▼                    ▼
┌─────────┐         ┌──────────┐
│Supabase │         │  Stripe  │
│(users,  │         │(billing) │
│ subs)   │         └──────────┘
└─────────┘
```

**Server scope:** email, Stripe customer ID, subscription status, coarse usage count (for Pro users' own history). Never the PDF, never content, never redaction targets.

**Client scope:** everything related to the document — render, pattern detection, drawing redactions, flattening, export, post-redaction verification.

**Route split:**

- `/`, `/pricing`, `/privacy`, `/security`, `/how-it-works`, `/blog/*`, `/legal/*` — statically generated (SSG)
- `/app` — client-only React shell, loads PDF.js lazily
- `/account`, `/login` — SSR with Supabase session

## Redaction engine

The engine is the product. Output must be **true redactions** — underlying text objects removed, not just black rectangles drawn on top. Competitors have been sued for this exact bug (redacted text still copy-pasteable).

### Pipeline

1. **Load** — PDF.js parses the upload; pages render to `<canvas>`.
2. **Mark** — user identifies redaction targets via one of three input modes:
    - **Manual**: drag boxes on canvas; coords captured directly.
    - **Text search**: `getTextContent()` returns text items with bounding boxes; match string; collect boxes.
    - **Auto-detect**: extract text; run regex for SSN (`\b\d{3}-\d{2}-\d{4}\b`), email, phone, credit card; collect boxes.

   All three modes feed a single target list: `{ page, x, y, w, h }[]`.
3. **Apply** — pdf-lib opens the original bytes. For each target:
    - Draw opaque black rectangle at coords.
    - Remove underlying text objects intersecting the box.
    - Remove images intersecting the box.
    Then flatten: re-save with annotations merged into content.
4. **Verify** — re-open the output with PDF.js, extract text, assert none of the redacted strings remain. If any leak detected, hard-fail the export with a clear error. **This step is the moat and is non-negotiable in v1.**
5. **Export** — download, or pipe to certificate generator (hash + page count + timestamp + region count).

### Edge cases

- **Scanned / image-only PDFs** (no extractable text): detect during load; show "This PDF appears to be scanned. OCR redaction is coming soon. [Notify me]" → captures email to waitlist. Defer OCR to v1.1.
- **Encrypted PDFs**: prompt for password; use PDF.js decryption.
- **Forms with dynamic XFA**: warn, best-effort.

## Auth, billing, and cap enforcement

### Auth (Supabase)

- Magic-link email only. No password UX. No OAuth in MVP.
- Session cookie set via `/api/auth/callback`.
- Free tier requires **no account** — this is critical for SEO conversion. Account is only forced at Pro upgrade.

### Billing (Stripe)

- Stripe Checkout (hosted) + Billing Portal (hosted). We do not build payment UI.
- Flow:
  1. User hits cap → "Upgrade to Pro" CTA.
  2. Magic-link signup/login → `/api/stripe/create-checkout-session`.
  3. Stripe hosted checkout → webhook (`/api/stripe/webhook`) → write `subscription` row in Supabase.
  4. Client reads `subscription.status === 'active'` → unlocks unlimited.

### Cap enforcement

- **Anonymous**: LocalStorage counter `{ date, count }`, resets at midnight user-local. Trivially bypassable (incognito, clear storage) — **and that's fine**. The cap is a nudge, not DRM. Power users bypass once, find it annoying, and upgrade.
- **Signed-in free**: counter synced server-side via `/api/usage/increment` (atomic, Supabase RLS). Prevents multi-device cap farming.
- **Pro**: no cap. `usage_events` rows logged for the user's own history view (client-side timestamp + filename hash only — no content).

### Explicitly not built

- IP rate limits, browser fingerprinting, CAPTCHA gates. These break the trust pitch and the SEO landing experience.

## Data model (Supabase / Postgres)

```sql
-- Managed by Supabase Auth.
auth.users (
  id uuid primary key,
  email text,
  created_at timestamptz
)

-- One row per user. Tracks subscription state + daily counter.
public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  plan text not null default 'free',      -- 'free' | 'pro' | 'enterprise'
  subscription_status text,                -- 'active' | 'past_due' | 'canceled' | null
  current_period_end timestamptz,
  daily_usage_count int not null default 0,
  daily_usage_date date,                   -- reset trigger when != today
  created_at timestamptz default now()
)

-- Only written for signed-in users. Content-free: no filenames, no text, no targets.
public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  occurred_at timestamptz default now(),
  page_count int,                          -- for Pro history view stats only
  mode text                                -- 'manual' | 'search' | 'auto'
)
create index on public.usage_events (user_id, occurred_at desc);

-- Stripe webhook idempotency.
public.stripe_events (
  id text primary key,                     -- Stripe event.id
  type text,
  received_at timestamptz default now()
)
```

**Row-level security:**

- `profiles`: user can select/update own row only. Service role writes `plan` / `subscription_*` on webhook.
- `usage_events`: user can insert + select own rows only. No update/delete.

**Never stored:** PDF bytes, filenames with PII, redaction coordinates, redacted strings, IP addresses, user agents, device fingerprints.

The `/privacy` page publishes this schema verbatim as a trust artifact.

## Pages and routes

### Public (SSG, SEO-optimized)

| Route | Purpose |
|---|---|
| `/` | Landing: hero, 30-sec demo loop, "Try now (no signup)" CTA → `/app`, trust bullets, pricing preview |
| `/pricing` | Three-tier table; Enterprise = "Contact us" |
| `/privacy` | Trust doc: client-side architecture in plain English, publishes DB schema, links to OSS verifier (v1.1) |
| `/security` | Technical detail: what PDF.js / pdf-lib do, how verification works, threat model |
| `/how-it-works` | Illustrated walkthrough; targets long-tail SEO |
| `/blog/*` | MDX route reserved; posts deferred |
| `/legal/terms`, `/legal/dpa` | Boilerplate + compliance pack origin |
| `/404`, `/500` | Standard |

### App (client-only React)

| Route | Purpose |
|---|---|
| `/app` | The redactor. Drag/drop → editor → export. Works logged-out. |
| `/login` | Magic-link form. Post-login → redirect to `/app` or `/account`. |
| `/account` | Subscription status, Stripe portal link, usage history (Pro), delete account. |
| `/upgrade` | Triggered from cap-hit modal; kicks off Stripe checkout. |

### API (Vercel serverless / edge)

| Route | Purpose |
|---|---|
| `/api/auth/callback` | Supabase magic-link handler |
| `/api/stripe/create-checkout-session` | Returns Stripe checkout URL |
| `/api/stripe/create-portal-session` | Returns Stripe billing portal URL |
| `/api/stripe/webhook` | `checkout.session.completed`, `customer.subscription.*` → update `profiles` |
| `/api/usage/increment` | Signed-in users only; atomic increment with daily reset |
| `/api/waitlist` | Enterprise / OCR / "Notify me" form submissions |

### SEO long-tail landing pages (launch with 3–5, grow to 20+)

- `/redact-pdf-online`
- `/redact-ssn-from-pdf`
- `/hipaa-pdf-redaction`
- `/free-pdf-redactor`
- `/redact-bank-statement`

Each is a dedicated SSG page with the relevant use-case walkthrough and CTA to `/app`. Organic traffic engine.

## Testing strategy

| Layer | Tool | Coverage |
|---|---|---|
| Unit | Vitest | Regex patterns (SSN, email, phone, CC), cap-counter logic, Stripe webhook handlers, date/timezone reset |
| Component | Vitest + React Testing Library | Redaction canvas interactions, search UI, upgrade modal states |
| Integration | Playwright | Upload → mark → export round-trip with fixture PDFs; verify extracted text does NOT contain redacted strings |
| Fixture corpus | Committed PDFs | Plain text, multi-page, encrypted, form fields, embedded fonts, non-latin scripts, scanned (must trigger the OCR-coming-soon modal) |
| Manual QA | Adobe Reader + macOS Preview + Chrome | Copy-paste attack on every exported fixture; confirm no leak |
| E2E smoke | Playwright on Vercel Preview | Per PR: marketing pages render, `/app` loads, auth callback works |

**Critical test — `verify-redaction.spec.ts`:** every fixture PDF runs the full pipeline, extracts text from the output, asserts redacted strings are absent. This test is the product guarantee. If it fails, we do not ship.

## Deployment and monitoring

- GitHub → Vercel (auto-deploy `main`, preview deploys per PR).
- Supabase project (free tier: 500MB DB, 50k MAU).
- Stripe test mode until launch; live keys via Vercel env vars.
- Domains: `onlineredactor.com` → Vercel primary; `.net` and `onlineredaction.com` → 301 redirects via Vercel.
- Vercel Analytics (free) for traffic.
- Sentry free tier for client errors — aggressively scrubbed (no PDF bytes, no filenames in breadcrumbs).
- Stripe dashboard for revenue.
- Supabase logs for auth/webhook issues.
- Plausible or Umami later for richer product analytics; privacy-respecting choices align with brand.

## Launch plan (roughly 4–5 weeks of evenings / weekends)

- **Week 1** — Next.js scaffold, marketing pages (`/`, `/pricing`, `/privacy`), PDF.js + pdf-lib redactor MVP (manual only), verification step.
- **Week 2** — Text search + auto-detect regex, full fixture test corpus, `verify-redaction.spec.ts` green across corpus.
- **Week 3** — Supabase auth (magic link), Stripe checkout + webhook, cap enforcement, upgrade flow.
- **Week 4** — Polish, long-tail SEO pages, `/security` and `/privacy` detail docs, Sentry, redaction certificate (with watermark for free).
- **Week 5** — Soft launch: Product Hunt, Show HN, r/legaltech, r/sysadmin, r/privacy. Monitor conversion, iterate copy.

## Explicitly deferred (revisit post-launch)

- OCR redaction for scanned PDFs (v1.1)
- Server-side API (separately-branded product, explicit trust tradeoff)
- Enterprise tier in full (SSO, team admin, audit log sync, compliance pack, self-hosted)
- Open-source redaction verifier (v1.1)
- Blog content / editorial SEO
- Additional OAuth providers, password auth
