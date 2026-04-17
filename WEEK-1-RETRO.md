# Week 1 Retrospective — onlineredactor.com

**Period:** 2026-04-16
**Branch:** `feat/week-1-mvp-scaffold`
**Head:** `c2a3f63` (test: verify-redaction spec) → retro commit on top
**Status:** All 15 tasks shipped (plus 12b, 12c). 12 unit-test files / 26 unit tests green. 2 Playwright e2e tests green (`smoke`, `verify-redaction`). Production build prerenders all 6 routes.

## Scope delivered

Marketing surface:
- Landing page at `/` with hero "A PDF redactor that proves your redactions worked", three trust bullets ("Works logged-out", "Never uploaded", "Verified on export"), and a primary CTA to `/app`.
- Pricing page at `/pricing` with the three-tier table (Free / Prosumer / Enterprise) and the honesty line ("honor system… we would rather you upgrade because the product is worth it").
- Privacy page at `/privacy` with the verbatim DB-schema block and the "never stored" list.
- Legal page at `/legal/license` summarizing the AGPL posture; full `LICENSE` at repo root; footer on every page linking to the GitHub source (AGPL §13).
- Site header + footer + root layout shared across all pages.

Product surface:
- `/app` route shell, client-only, hydrates `<Redactor />` without SSR to avoid `DOMMatrix`/jsdom crashes.
- File input → `pdfjs-dist` render loop that paints each page to a `<canvas>` at device-pixel-ratio, with prior-doc teardown on file swap and stable page keys.
- Manual click-drag overlay for drawing redaction boxes on top of the canvas with canvas-relative coords.
- Apply pipeline: canvas-space boxes → PDF-space quads → MuPDF `applyRedactions` on every page → save new PDF bytes → PDF.js re-open of the output → text extraction → assertion that every seeded string is absent → downloaded blob or hard-fail with surfaced error. Buffer detachment closed; empty-seeded (image-only region) case flagged, not silently downloaded.
- AGPL-3.0 LICENSE at repo root; `github.com/CtrlAltMike/onlineredactor` wired into footer + license page.

Test surface:
- 12 unit-test files covering: footer, header, landing copy, pricing copy, privacy copy, license copy, PDF types, canvas coord math, apply/verify seams, the MuPDF apply wrapper, fixture generator invariants, and the `getPdfjs` env-aware loader.
- Playwright `smoke.spec.ts` (homepage 200) and `verify-redaction.spec.ts` (the product moat: apply → re-extract → assert SSN absent on `plain-ssn.pdf`).
- Programmatic fixture generator (`scripts/generate-fixtures.mjs`) producing `plain-ssn.pdf` and `multi-page.pdf` on demand before e2e runs.

Tooling:
- Next 16 + Turbopack + TypeScript + Tailwind + App Router.
- Vitest + React Testing Library.
- Playwright with a piped `webServer` stdout so dev-server errors surface in CI logs.
- ESLint config, `tsconfig.json`, `postcss.config.mjs`.

## Plan vs. reality — where the plan needed adaptation

Each deviation below has a shipped commit we can blame (or credit).

- **`next.config.mjs` → `next.config.ts`** — Next 16 scaffold defaulted to TypeScript config and Turbopack. We adapted rather than fought it. Webpack config and Turbopack config are separate surfaces; we kept both branches minimal. Landed in the scaffold commit `332c3be`.
- **`dynamic({ ssr: false })` cannot be used inside a Server Component.** Needed a client wrapper that owns the dynamic import, with metadata living in a sibling layout. Landed in `5b8be37 feat: add /app shell with client-only redactor placeholder`.
- **pdfjs-dist 5.x changed the render API** — `page.render({ canvas, viewport })` is the new shape, not the old `canvasContext` arg. Landed in `f21d5a4 feat: render PDF pages to canvas via PDF.js worker`.
- **pdfjs-dist loaded eagerly crashed SSR and jsdom via `DOMMatrix`.** Resolved by making the loader lazy and environment-aware: `getPdfjs()` returns the legacy build under Node (for Vitest + worker.mjs paths) and the modern build under a real DOM. Landed alongside the render work in `f21d5a4`.
- **`createRequire('node:module')` didn't resolve under Turbopack.** Turbopack's static analyzer rejects `node:`-prefixed imports at build time, and `import.meta.resolve` isn't implemented at runtime under Turbopack. Replaced with `createRequire(import.meta.url)` + `new URL(..., import.meta.url)` + explicit dual-branch (Node vs browser). Landed in `9d0525d`.
- **The `pdf-lib.drawRectangle` overlay bug — the big one.** The first apply implementation drew black rectangles on top of the text. Unit tests were green. A red-team review caught that the "redacted" text was still copy-pasteable from the exported PDF — the exact bug that has gotten competitors sued (and the attack class in arxiv 2206.02285). We pivoted the entire redaction engine to MuPDF (`PDFPage.applyRedactions` rewrites the content stream, dropping `Tj`/`TJ`/`'`/`"` operators intersecting the quad). `pdf-lib` is now restricted to test fixture generation. Landed in `9d0525d feat(apply): switch redaction engine to MuPDF for true content-stream redaction` and the `CLAUDE.md` refresh at `8080f76`.
- **Verify-redaction coord math in the plan's Task 14 spec wasn't quite right.** The plan's pseudocode mixed canvas-DPR pixels with PDF user-space units and assumed Y-flip in the wrong direction for multi-page docs. Corrected during the verify/apply pipeline work at `604c69a feat: redaction apply + verify pipeline with canvas→PDF coord conversion` and hardened in `a06fd62 fix(apply): close buffer detachment, empty-seeded guarantee, and error surfacing`.
- **Apply pipeline had three cross-cutting bugs** found in a second review pass after the MuPDF pivot: (1) the `Uint8Array` backing store was being detached by `postMessage`-style handoffs, (2) empty-seeded target lists passed verification vacuously (a box drawn over a pure-image region had nothing to seed, so "no seeded string survives" was trivially true — producing a downloaded file that looked redacted but couldn't be proven to be), (3) exceptions inside the apply worker were swallowed instead of surfaced to the UI. All fixed in `a06fd62`.
- **Programmatic fixtures instead of checked-in binaries.** The plan had us committing PDFs. We shipped a `scripts/generate-fixtures.mjs` that produces them on-demand via `pdf-lib` so reviewers can regenerate, diff, and extend the corpus without blobs in git. Landed in `323c84c`.

## What we learned (durable lessons — candidates for CLAUDE.md if not already there)

- **Green unit tests can coexist with a broken product guarantee.** The round-trip regression test (apply → re-extract → assert absent) is the minimum viable coverage for a redaction product. Seam-level tests of `applyRedactionsToPdf` said nothing about whether the exported file survived re-extraction. `CLAUDE.md` already carries this as a working norm; it earned its place in Week 1.
- **Red-team reviews pay for themselves when they try to BREAK the claim, not confirm the spec.** The overlay bug was invisible to specification-first review. It only surfaced when a reviewer opened the "redacted" export in a text tool.
- **AGPL is not a compromise for a privacy-first product; it reinforces the brand.** Paying Artifex's commercial MuPDF license would have broken the bootstrap; AGPL-ing the whole app turns the licensing constraint into the trust story. "Here's every line of code too" is the source-available equivalent of "here's every column in our DB."
- **Turbopack's static analysis rejects `node:`-prefixed imports and `import.meta.resolve` isn't runtime-available under Turbopack.** Dual-branch Node-vs-browser with `createRequire(import.meta.url)` is the pattern. Worth codifying.
- **Verify-and-reverify on load-bearing decisions.** Never ship a guarantee off a single review. The MuPDF pivot happened because one reviewer didn't stop at "the spec matches"; they tried to defeat the output.
- **When a reviewer says "I reproduced the failure end-to-end," treat it as Critical.** Not as an edge case, not as a one-fixture anomaly. That is the exact failure mode the product is sold on.

## Deferred into Week 2 / v1.1 / later

Things we know are needed but consciously did NOT build in Week 1:

- **Standard font assets for pdfjs in the browser.** Real PDFs reference Helvetica / Times-Roman / Courier by name; the browser-side verify passes through a font lookup that currently returns a same-origin path that 404s (we see `UnknownErrorException: Unable to load font data at …/node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf` in the verify-redaction run). Our fixtures embed their fonts so verification still succeeds, but real user PDFs that reference the 14 standard fonts will silently degrade. Fix: copy `pdfjs-dist/standard_fonts/` into `public/` and point the worker at the served path. First task on the Week-2 product list.
- **Supabase magic-link auth** (Week 2 in the design doc). Account forced only at Pro upgrade.
- **Stripe Checkout + webhook + free-tier cap enforcement.** LocalStorage counter for anon, server-synced for signed-in free.
- **Text search mode and pattern auto-detect** (SSN / phone / email / DOB regex families).
- **OCR for scanned PDFs** (v1.1). Tesseract WASM is ~10MB; deferred.
- **Batch mode** (multi-file queue).
- **Long-tail SEO pages.** The plan had five; we shipped three (`/`, `/pricing`, `/privacy`). Still to build: `/security`, `/how-it-works`, plus category posts under `/blog/*` (route reserved).
- **Redaction certificate generator** (hash-stamped, downloadable alongside the PDF).
- **Extended fixture corpus.** Currently 2 (`plain-ssn`, `multi-page`). Still needed: encrypted, AcroForm fields, embedded-font-only, non-latin (CJK/RTL), scanned-image-only, mixed-orientation, pages with rotated CTM.
- **Sentry wiring** (client errors, scrubbed — no PDF bytes, no filenames in breadcrumbs).
- **Analytics** (Vercel Analytics or Plausible).
- **Turbopack workspace-root warning.** A stale `/Users/michaelhendrick/package-lock.json` at the home-dir level makes Turbopack infer the wrong root. Cosmetic only; silence via `turbopack.root` in `next.config.ts` when we tidy up. Not worth a Week-1 commit.
- **Standalone open-source verifier** — obviated by the AGPL decision. The whole app is the verifier. Skip.
- **Enterprise tier** — SSO, team admin, saved rulesets, BAA/DPA. Schema reserves the tables; we don't create them until first real inbound.

## Known limitations — "we'd fix this if we weren't bootstrapping"

- **Empty-seeded fallback in manual mode.** If the user draws a box over a region that has no extractable text (a pure-image region, a scanned page, or a non-Latin glyph that PDF.js didn't decode), the seeded target list is empty, verification passes vacuously, and the apply step still rewrites the content stream under the quad — but we can't *prove* it. The `a06fd62` fix raises a user-visible warning in this case and blocks silent download. Week-N real fix: implement a spatial check ("any extractable text remaining inside the redacted quad after apply") in addition to the string-absence check.
- **No try/catch at the render pipeline layer.** `renderPageToCanvas` cancellation is correct (we tear down the previous doc on file swap), but other PDF.js failures during page render surface as console errors rather than UI errors. Week-N: wrap `renderPageToCanvas` with a toast/state surface.
- **No PDF-size cap.** Very large PDFs will hang the browser tab — MuPDF WASM and PDF.js both load the whole doc into memory. Week-N: add a pre-load size check with a warning threshold and a hard cap.
- **No service worker / offline mode.** Trivially addable but we haven't; the trust story survives without it because nothing goes to the server anyway.
- **Two pre-existing lint issues** remain from earlier commits (`f21d5a4`, `9d0525d`): one `@typescript-eslint/no-explicit-any` in `test/pdf-page-canvas.test.tsx` and one `import/no-anonymous-default-export` warning in `lib/stubs/empty.js`. Not touched in Task 15. Worth a Week-2 cleanup pass.

## Repo posture

- Private on GitHub for now: `github.com/CtrlAltMike/onlineredactor`. **Must be public before first deploy** (AGPL §13 source-availability, and the footer + license page both reference the public repo URL as load-bearing trust copy).
- Two worktrees: `main` (design doc + CLAUDE.md + .gitignore) and `.worktrees/week-1-mvp-scaffold` (this branch). The feature branch is now pushed and tracked against `origin/feat/week-1-mvp-scaffold`.
- No CI/CD wired yet. Vercel preview deploys come post-merge; public-flip is a gate before that.
- Branch is ready to PR or merge to `main` once public-flip and Week-2 scope are agreed.

## How to verify this retro isn't fiction

```bash
cd .worktrees/week-1-mvp-scaffold
npm test && npm run e2e && npm run build
```

All three should be clean:
- `npm test` → 12 files / 26 tests passed
- `npm run e2e` → 2 tests passed (1 warning about standard-font TTF 404 is expected and called out above)
- `npm run build` → `/`, `/_not-found`, `/app`, `/legal/license`, `/pricing`, `/privacy` all prerendered as static

If any fail, don't trust this retro.
