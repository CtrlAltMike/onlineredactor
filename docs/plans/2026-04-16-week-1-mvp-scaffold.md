# Week 1 MVP Scaffold Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship the foundation of onlineredactor.com — Next.js scaffold, the three public marketing pages (`/`, `/pricing`, `/privacy`), and a working manual-only client-side PDF redactor with automated post-redaction verification.

**Architecture:** Next.js App Router (SSG for marketing, client-only for `/app`). Redaction pipeline runs entirely in-browser via PDF.js (render, extract) and pdf-lib (apply, flatten). Every redaction is re-opened post-export and text-scanned to assert redacted strings are absent — if that check fails, export is blocked. See `docs/plans/2026-04-16-onlineredactor-design.md` for full product context and non-negotiables.

**Tech Stack:** Next.js 14+ (App Router, TypeScript, Tailwind), `pdf-lib`, `pdfjs-dist`, Vitest + React Testing Library, Playwright, `@testing-library/jest-dom`.

**Scope out (this plan):** Text search, auto-detect regex, auth, Stripe, cap enforcement, SEO long-tail pages, blog. These are Weeks 2–5.

**Worktree:** `.worktrees/week-1-mvp-scaffold` on branch `feat/week-1-mvp-scaffold`.

---

## Pre-flight

Run from the worktree root:

```bash
cd /Users/michaelhendrick/Documents/onlineredactor/.worktrees/week-1-mvp-scaffold
pwd  # confirm path
git branch --show-current  # expect: feat/week-1-mvp-scaffold
```

---

## Task 1: Scaffold Next.js app

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.eslintrc.json`

**Step 1: Run `create-next-app` into the current worktree**

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --use-npm \
  --no-turbopack
```

When prompted to proceed into a non-empty directory, answer **yes**. It preserves `.git/`, `docs/`, `CLAUDE.md`, `.gitignore`.

**Step 2: Verify**

```bash
ls -la
npm run dev  # should serve on http://localhost:3000; Ctrl-C to exit
```

**Step 3: Replace the default landing page with a placeholder**

Replace `app/page.tsx` contents with:

```tsx
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="text-2xl font-semibold">OnlineRedactor — coming soon</h1>
    </main>
  );
}
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: scaffold Next.js app (TypeScript, Tailwind, App Router)"
```

---

## Task 2: Install and configure Vitest + React Testing Library

**Files:**
- Modify: `package.json` (add dev deps, test scripts)
- Create: `vitest.config.ts`, `test/setup.ts`, `test/example.test.tsx`

**Step 1: Install**

```bash
npm install -D vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    css: false,
    exclude: ['**/node_modules/**', '**/.next/**', '**/e2e/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

**Step 3: Create `test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

**Step 4: Add npm scripts to `package.json`**

Inside `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 5: Write a sanity test at `test/example.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function Greet({ name }: { name: string }) {
  return <p>Hello, {name}</p>;
}

describe('sanity', () => {
  it('renders a component', () => {
    render(<Greet name="world" />);
    expect(screen.getByText('Hello, world')).toBeInTheDocument();
  });
});
```

**Step 6: Run tests**

Run: `npm test`
Expected: `1 passed`.

**Step 7: Commit**

```bash
git add .
git commit -m "feat: add Vitest + React Testing Library with sanity test"
```

---

## Task 3: Install and configure Playwright

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`, `.gitignore` (append)

**Step 1: Install Playwright**

```bash
npm init playwright@latest -- --quiet \
  --browser=chromium \
  --no-examples \
  --install-deps=false
```

Select `TypeScript`, `e2e` as directory name, no CI workflow.

**Step 2: Overwrite `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
```

**Step 3: Write a smoke test at `e2e/smoke.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('homepage renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
```

**Step 4: Add npm scripts to `package.json`**

```json
"e2e": "playwright test",
"e2e:ui": "playwright test --ui"
```

**Step 5: Append to `.gitignore`**

```
# Playwright
test-results/
playwright-report/
playwright/.cache/
```

**Step 6: Install browsers**

```bash
npx playwright install chromium
```

**Step 7: Run e2e**

Run: `npm run e2e`
Expected: `1 passed`.

**Step 8: Commit**

```bash
git add .
git commit -m "feat: add Playwright with homepage smoke test"
```

---

## Task 4: Root layout + site chrome

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css`
- Create: `components/site-header.tsx`, `components/site-footer.tsx`, `test/site-header.test.tsx`

**Step 1: Write failing test at `test/site-header.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteHeader } from '@/components/site-header';

describe('SiteHeader', () => {
  it('renders the brand name linking to home', () => {
    render(<SiteHeader />);
    const brand = screen.getByRole('link', { name: /onlineredactor/i });
    expect(brand).toHaveAttribute('href', '/');
  });

  it('links to pricing and privacy', () => {
    render(<SiteHeader />);
    expect(screen.getByRole('link', { name: /pricing/i })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('link', { name: /privacy/i })).toHaveAttribute('href', '/privacy');
  });
});
```

**Step 2: Run the test**

Run: `npm test -- site-header`
Expected: FAIL (`Cannot find module '@/components/site-header'`).

**Step 3: Create `components/site-header.tsx`**

```tsx
import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          OnlineRedactor
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/pricing">Pricing</Link>
          <Link href="/privacy">Privacy</Link>
          <Link
            href="/app"
            className="rounded-md bg-black text-white px-3 py-1.5 text-sm"
          >
            Open tool
          </Link>
        </nav>
      </div>
    </header>
  );
}
```

**Step 4: Create `components/site-footer.tsx`**

```tsx
export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 mt-16">
      <div className="max-w-5xl mx-auto px-4 py-8 text-xs text-neutral-500 flex items-center justify-between">
        <span>© {new Date().getFullYear()} OnlineRedactor</span>
        <span>Your files never leave your browser.</span>
      </div>
    </footer>
  );
}
```

**Step 5: Update `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'OnlineRedactor — client-side PDF redaction',
  description:
    'Redact PDFs in your browser. Files never leave your device. Automated verification confirms every redaction worked.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-white text-neutral-900">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
```

**Step 6: Run tests**

Run: `npm test`
Expected: all passing.

**Step 7: Commit**

```bash
git add .
git commit -m "feat: add site header, footer, and root layout"
```

---

## Task 5: Landing page

**Files:**
- Modify: `app/page.tsx`
- Create: `test/landing.test.tsx`

**Step 1: Write failing tests at `test/landing.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '@/app/page';

describe('Landing page', () => {
  it('shows the headline', () => {
    render(<Home />);
    expect(
      screen.getByRole('heading', { level: 1, name: /proves your redactions worked/i })
    ).toBeInTheDocument();
  });

  it('has a primary CTA linking to /app', () => {
    render(<Home />);
    const cta = screen.getByRole('link', { name: /try now/i });
    expect(cta).toHaveAttribute('href', '/app');
  });

  it('advertises works-logged-out', () => {
    render(<Home />);
    expect(screen.getByText(/works logged-out/i)).toBeInTheDocument();
  });

  it('advertises files-stay-in-browser', () => {
    render(<Home />);
    expect(screen.getByText(/never leave your browser/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run the tests**

Run: `npm test -- landing`
Expected: 4 failing tests.

**Step 3: Replace `app/page.tsx`**

```tsx
import Link from 'next/link';

const bullets = [
  {
    title: 'Files stay in your browser',
    body: 'Your PDFs never leave your device. All processing happens client-side.',
  },
  {
    title: 'Verified redactions',
    body:
      'Unlike Adobe defaults, we verify your redactions worked. Every export is re-opened and scanned before download.',
  },
  {
    title: 'Works logged-out',
    body: 'No signup required for the free tier. Drop a file, redact, download.',
  },
];

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-4 pt-16 pb-24">
      <section className="max-w-2xl">
        <h1 className="text-5xl font-semibold tracking-tight leading-[1.1]">
          A PDF redactor that proves your redactions worked.
        </h1>
        <p className="mt-6 text-lg text-neutral-600">
          Redact sensitive text in your browser. Files never leave your device.
          Every export is verified before you can download it.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Link
            href="/app"
            className="rounded-md bg-black text-white px-5 py-3 text-sm font-medium"
          >
            Try now — no signup
          </Link>
          <Link href="/pricing" className="text-sm underline underline-offset-4">
            See pricing
          </Link>
        </div>
      </section>

      <section className="mt-24 grid md:grid-cols-3 gap-8">
        {bullets.map((b) => (
          <div key={b.title}>
            <h3 className="font-medium">{b.title}</h3>
            <p className="mt-2 text-sm text-neutral-600">{b.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
```

**Step 4: Run tests**

Run: `npm test`
Expected: all passing.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: build landing page with hero and trust bullets"
```

---

## Task 6: Pricing page

**Files:**
- Create: `app/pricing/page.tsx`, `test/pricing.test.tsx`

**Step 1: Write failing tests at `test/pricing.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PricingPage from '@/app/pricing/page';

describe('Pricing page', () => {
  it('shows three tiers', () => {
    render(<PricingPage />);
    expect(screen.getByRole('heading', { name: /consumer/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /prosumer/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /enterprise/i })).toBeInTheDocument();
  });

  it('shows the consumer cap honesty line', () => {
    render(<PricingPage />);
    expect(screen.getByText(/honor system/i)).toBeInTheDocument();
  });

  it('shows Enterprise as contact-us', () => {
    render(<PricingPage />);
    expect(screen.getByRole('link', { name: /contact us/i })).toBeInTheDocument();
  });
});
```

**Step 2: Run tests**

Run: `npm test -- pricing`
Expected: all failing.

**Step 3: Create `app/pricing/page.tsx`**

```tsx
import Link from 'next/link';

type Tier = {
  name: string;
  price: string;
  blurb: string;
  features: string[];
  cta: { label: string; href: string };
};

const tiers: Tier[] = [
  {
    name: 'Consumer',
    price: 'Free',
    blurb: 'For occasional redactions. No signup required.',
    features: [
      'Manual redaction, text search, auto-detect',
      '3 redactions per 24 hours',
      'Watermarked redaction certificate',
    ],
    cta: { label: 'Open the tool', href: '/app' },
  },
  {
    name: 'Prosumer',
    price: '$7/mo',
    blurb: 'For freelancers, paralegals, solo HR, journalists.',
    features: [
      'Unlimited redactions',
      'Batch mode (drop folder)',
      'Clean redaction certificate',
      'Saved redaction rules + local history',
    ],
    cta: { label: 'Upgrade', href: '/upgrade' },
  },
  {
    name: 'Enterprise',
    price: 'From $15/seat',
    blurb: 'For legal, healthcare, HR teams that need audit and SSO.',
    features: [
      'Team admin + SSO',
      'Customer-owned audit log sync',
      'HIPAA BAA + DPA',
      'Priority support + SLA',
    ],
    cta: { label: 'Contact us', href: 'mailto:sales@onlineredactor.com' },
  },
];

export default function PricingPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 pt-16 pb-24">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-4 text-neutral-600">
          Our free tier cap is on the honor system — we would rather you
          upgrade because the product is worth it, not because we fingerprint
          you.
        </p>
      </header>

      <section className="mt-12 grid md:grid-cols-3 gap-6">
        {tiers.map((t) => (
          <div
            key={t.name}
            className="rounded-lg border border-neutral-200 p-6 flex flex-col"
          >
            <h2 className="text-lg font-medium">{t.name}</h2>
            <p className="mt-1 text-2xl font-semibold">{t.price}</p>
            <p className="mt-2 text-sm text-neutral-600">{t.blurb}</p>
            <ul className="mt-6 space-y-2 text-sm flex-1">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span aria-hidden>·</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={t.cta.href}
              className="mt-6 rounded-md bg-black text-white text-center px-4 py-2 text-sm"
            >
              {t.cta.label}
            </Link>
          </div>
        ))}
      </section>
    </main>
  );
}
```

**Step 4: Run tests**

Run: `npm test`
Expected: all passing.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add pricing page with three-tier table"
```

---

## Task 7: Privacy page

**Files:**
- Create: `app/privacy/page.tsx`, `test/privacy.test.tsx`

**Step 1: Write failing tests at `test/privacy.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrivacyPage from '@/app/privacy/page';

describe('Privacy page', () => {
  it('states files never leave the browser', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/never leave your browser/i)).toBeInTheDocument();
  });

  it('lists the database schema verbatim', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/stripe_customer_id/i)).toBeInTheDocument();
    expect(screen.getByText(/daily_usage_count/i)).toBeInTheDocument();
  });

  it('enumerates what is never stored', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/never stored/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF bytes/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run tests**

Run: `npm test -- privacy`
Expected: all failing.

**Step 3: Create `app/privacy/page.tsx`**

```tsx
const schema = `public.profiles (
  id uuid primary key,
  stripe_customer_id text unique,
  plan text not null default 'free',
  subscription_status text,
  current_period_end timestamptz,
  daily_usage_count int not null default 0,
  daily_usage_date date,
  created_at timestamptz default now()
)

public.usage_events (
  id bigint primary key,
  user_id uuid,
  occurred_at timestamptz,
  page_count int,
  mode text
)

public.stripe_events (
  id text primary key,
  type text,
  received_at timestamptz
)`;

const neverStored = [
  'PDF bytes',
  'Filenames containing personal information',
  'Redaction coordinates or targets',
  'Extracted or redacted text',
  'IP addresses',
  'User agents',
  'Device fingerprints',
];

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 pt-16 pb-24">
      <h1 className="text-4xl font-semibold tracking-tight">Privacy</h1>

      <p className="mt-6 text-neutral-700">
        Your files never leave your browser. Rendering, text extraction,
        redaction, and verification all run in-page using WebAssembly and
        JavaScript. Our servers handle only authentication, billing, and
        subscription state — never the documents you upload.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-medium">Here is literally every column we have about you</h2>
        <p className="mt-2 text-sm text-neutral-600">
          This is the complete database schema for your account. Nothing
          related to your documents is stored server-side.
        </p>
        <pre className="mt-4 rounded-md bg-neutral-100 p-4 text-xs overflow-x-auto">
          {schema}
        </pre>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-medium">Never stored, server-side or client-side, on any of our systems</h2>
        <ul className="mt-4 space-y-2 text-sm text-neutral-700">
          {neverStored.map((x) => (
            <li key={x} className="flex gap-2">
              <span aria-hidden>·</span>
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

**Step 4: Run tests**

Run: `npm test`
Expected: all passing.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add privacy page with schema and never-stored list"
```

---

## Task 8: Install PDF libraries

**Files:**
- Modify: `package.json`, `next.config.mjs`
- Create: `lib/pdf/types.ts`

**Step 1: Install**

```bash
npm install pdf-lib pdfjs-dist
```

**Step 2: Configure Next.js to serve the PDF.js worker**

Append to `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
```

(If the existing file already has a `nextConfig`, merge the `webpack` fn in; do not duplicate the export.)

**Step 3: Create shared types at `lib/pdf/types.ts`**

```ts
export type RedactionTarget = {
  page: number;   // 0-indexed
  x: number;      // points, PDF coord space (origin bottom-left)
  y: number;
  width: number;
  height: number;
  text?: string;  // the string this region is expected to hide (for verification)
};

export type RedactionResult = {
  bytes: Uint8Array;
  pageCount: number;
  regionCount: number;
  sha256: string;
};
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: install pdf-lib + pdfjs-dist and add shared types"
```

---

## Task 9: `/app` shell (client-only)

**Files:**
- Create: `app/app/page.tsx`, `app/app/redactor-client.tsx`, `test/redactor-client.test.tsx`

**Step 1: Write failing tests at `test/redactor-client.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RedactorClient } from '@/app/app/redactor-client';

describe('RedactorClient', () => {
  it('shows a drop zone when no file is loaded', () => {
    render(<RedactorClient />);
    expect(screen.getByText(/drop a pdf/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run tests**

Run: `npm test -- redactor-client`
Expected: failing.

**Step 3: Create `app/app/redactor-client.tsx`**

```tsx
'use client';

import { useState } from 'react';

export function RedactorClient() {
  const [file, setFile] = useState<File | null>(null);

  if (!file) {
    return (
      <section className="border-2 border-dashed border-neutral-300 rounded-lg p-16 text-center">
        <p className="text-lg">Drop a PDF here, or click to select.</p>
        <p className="mt-2 text-sm text-neutral-500">
          Your file is processed in your browser. It never leaves your device.
        </p>
        <input
          type="file"
          accept="application/pdf"
          aria-label="PDF file"
          className="mt-6"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
          }}
        />
      </section>
    );
  }

  return (
    <section>
      <p>Loaded: {file.name}</p>
    </section>
  );
}
```

**Step 4: Create `app/app/page.tsx` using dynamic import (disable SSR)**

```tsx
import dynamic from 'next/dynamic';

const RedactorClient = dynamic(
  () => import('./redactor-client').then((m) => m.RedactorClient),
  { ssr: false }
);

export const metadata = {
  title: 'OnlineRedactor — redact a PDF',
};

export default function AppPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 pt-8 pb-16">
      <RedactorClient />
    </main>
  );
}
```

**Step 5: Run tests**

Run: `npm test`
Expected: all passing.

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add /app shell with client-only redactor placeholder"
```

---

## Task 10: PDF renderer (PDF.js)

**Files:**
- Create: `lib/pdf/render.ts`, `components/pdf-page-canvas.tsx`, `test/pdf-page-canvas.test.tsx`
- Modify: `app/app/redactor-client.tsx`

**Context:** PDF.js ships a web worker. We wire it up once and reuse.

**Step 1: Create `lib/pdf/render.ts`**

```ts
'use client';

import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// Pin the worker to the same version we import. Use the .mjs worker
// so bundlers can resolve it from the pdfjs-dist package.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export async function loadPdfFromFile(file: File): Promise<PDFDocumentProxy> {
  const buffer = await file.arrayBuffer();
  return pdfjs.getDocument({ data: buffer }).promise;
}

export async function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale = 1.5
): Promise<{ viewportWidth: number; viewportHeight: number }> {
  const viewport = page.getViewport({ scale });
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { viewportWidth: viewport.width, viewportHeight: viewport.height };
}
```

**Step 2: Write failing test at `test/pdf-page-canvas.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PdfPageCanvas } from '@/components/pdf-page-canvas';

vi.mock('@/lib/pdf/render', () => ({
  renderPageToCanvas: vi.fn().mockResolvedValue({
    viewportWidth: 600,
    viewportHeight: 800,
  }),
}));

describe('PdfPageCanvas', () => {
  it('renders a canvas element with aria-label for the page', async () => {
    const fakePage = {} as any;
    render(<PdfPageCanvas page={fakePage} pageIndex={0} />);
    const canvas = await screen.findByLabelText(/page 1/i);
    expect(canvas.tagName).toBe('CANVAS');
  });
});
```

**Step 3: Run test**

Run: `npm test -- pdf-page-canvas`
Expected: failing.

**Step 4: Create `components/pdf-page-canvas.tsx`**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { renderPageToCanvas } from '@/lib/pdf/render';

type Props = {
  page: PDFPageProxy;
  pageIndex: number;
};

export function PdfPageCanvas({ page, pageIndex }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (ref.current) {
      renderPageToCanvas(page, ref.current).catch((err) => {
        if (!cancelled) console.error('render failed', err);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <canvas
      ref={ref}
      aria-label={`Page ${pageIndex + 1}`}
      className="block border border-neutral-200"
    />
  );
}
```

**Step 5: Wire into `app/app/redactor-client.tsx`**

Replace the file with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdfFromFile } from '@/lib/pdf/render';
import { PdfPageCanvas } from '@/components/pdf-page-canvas';

export function RedactorClient() {
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<Awaited<ReturnType<PDFDocumentProxy['getPage']>>[]>([]);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      const d = await loadPdfFromFile(file);
      if (cancelled) return;
      setDoc(d);
      const ps = [];
      for (let i = 1; i <= d.numPages; i++) ps.push(await d.getPage(i));
      if (!cancelled) setPages(ps);
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!file) {
    return (
      <section className="border-2 border-dashed border-neutral-300 rounded-lg p-16 text-center">
        <p className="text-lg">Drop a PDF here, or click to select.</p>
        <p className="mt-2 text-sm text-neutral-500">
          Your file is processed in your browser. It never leaves your device.
        </p>
        <input
          type="file"
          accept="application/pdf"
          aria-label="PDF file"
          className="mt-6"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
          }}
        />
      </section>
    );
  }

  return (
    <section>
      <p className="text-sm text-neutral-600">
        Loaded: {file.name} ({doc?.numPages ?? '…'} pages)
      </p>
      <div className="mt-4 space-y-4">
        {pages.map((p, i) => (
          <PdfPageCanvas key={i} page={p} pageIndex={i} />
        ))}
      </div>
    </section>
  );
}
```

**Step 6: Run tests**

Run: `npm test`
Expected: all passing.

**Step 7: Commit**

```bash
git add .
git commit -m "feat: render PDF pages to canvas via PDF.js worker"
```

---

## Task 11: Redaction overlay (manual box drawing)

**Files:**
- Create: `components/redaction-overlay.tsx`, `test/redaction-overlay.test.tsx`
- Modify: `components/pdf-page-canvas.tsx`, `app/app/redactor-client.tsx`

**Context:** Overlay an absolutely-positioned `<div>` on top of each page canvas. The user click-drags to create a rectangle; on `mouseup` we store `{ page, x, y, w, h }` in **canvas coordinates** (top-left origin). Conversion to PDF coordinate space (bottom-left origin, points) happens at apply time.

**Step 1: Write failing test at `test/redaction-overlay.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RedactionOverlay } from '@/components/redaction-overlay';

describe('RedactionOverlay', () => {
  it('calls onCommit with the drawn box in canvas coords', () => {
    const onCommit = vi.fn();
    render(
      <RedactionOverlay
        width={600}
        height={800}
        pageIndex={0}
        onCommit={onCommit}
      />
    );
    const overlay = screen.getByTestId('redaction-overlay-0');

    // Stub bounding client rect so coords are predictable.
    overlay.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 600, bottom: 800, width: 600, height: 800 } as DOMRect);

    fireEvent.mouseDown(overlay, { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(overlay, { clientX: 110, clientY: 70 });
    fireEvent.mouseUp(overlay, { clientX: 110, clientY: 70 });

    expect(onCommit).toHaveBeenCalledWith({
      page: 0,
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
  });
});
```

**Step 2: Run test**

Run: `npm test -- redaction-overlay`
Expected: failing.

**Step 3: Create `components/redaction-overlay.tsx`**

```tsx
'use client';

import { useRef, useState } from 'react';

type Box = { x: number; y: number; width: number; height: number };

type Props = {
  width: number;
  height: number;
  pageIndex: number;
  onCommit: (box: Box & { page: number }) => void;
  existing?: Array<Box>;
};

export function RedactionOverlay({
  width,
  height,
  pageIndex,
  onCommit,
  existing = [],
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  function pointerAt(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  return (
    <div
      ref={ref}
      data-testid={`redaction-overlay-${pageIndex}`}
      className="absolute inset-0 cursor-crosshair"
      style={{ width, height }}
      onMouseDown={(e) => {
        start.current = pointerAt(e);
        setDraft({ x: start.current.x, y: start.current.y, width: 0, height: 0 });
      }}
      onMouseMove={(e) => {
        if (!start.current) return;
        const p = pointerAt(e);
        setDraft({
          x: Math.min(start.current.x, p.x),
          y: Math.min(start.current.y, p.y),
          width: Math.abs(p.x - start.current.x),
          height: Math.abs(p.y - start.current.y),
        });
      }}
      onMouseUp={() => {
        if (draft && draft.width > 0 && draft.height > 0) {
          onCommit({ page: pageIndex, ...draft });
        }
        start.current = null;
        setDraft(null);
      }}
    >
      {existing.map((b, i) => (
        <div
          key={i}
          className="absolute bg-black/90"
          style={{ left: b.x, top: b.y, width: b.width, height: b.height }}
        />
      ))}
      {draft && draft.width > 0 && (
        <div
          className="absolute bg-black/60 outline outline-2 outline-red-500"
          style={{
            left: draft.x,
            top: draft.y,
            width: draft.width,
            height: draft.height,
          }}
        />
      )}
    </div>
  );
}
```

**Step 4: Wrap the canvas + overlay in `components/pdf-page-canvas.tsx`**

Replace with:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { renderPageToCanvas } from '@/lib/pdf/render';
import { RedactionOverlay } from '@/components/redaction-overlay';

type Box = { x: number; y: number; width: number; height: number };

type Props = {
  page: PDFPageProxy;
  pageIndex: number;
  viewportHeightPts: number; // page.view[3] - page.view[1]
  existing: Box[];
  onCommit: (box: Box & { page: number }) => void;
};

export function PdfPageCanvas({
  page,
  pageIndex,
  existing,
  onCommit,
}: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (ref.current) {
      renderPageToCanvas(page, ref.current).then((d) => {
        if (!cancelled) setDims({ w: d.viewportWidth, h: d.viewportHeight });
      });
    }
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className="relative inline-block">
      <canvas
        ref={ref}
        aria-label={`Page ${pageIndex + 1}`}
        className="block border border-neutral-200"
      />
      {dims && (
        <RedactionOverlay
          width={dims.w}
          height={dims.h}
          pageIndex={pageIndex}
          existing={existing}
          onCommit={onCommit}
        />
      )}
    </div>
  );
}
```

**Step 5: Collect targets in `redactor-client.tsx`**

Inside `RedactorClient`, add:

```tsx
const [targets, setTargets] = useState<
  Array<{ page: number; x: number; y: number; width: number; height: number }>
>([]);

// When rendering pages:
{pages.map((p, i) => (
  <PdfPageCanvas
    key={i}
    page={p}
    pageIndex={i}
    existing={targets.filter((t) => t.page === i)}
    onCommit={(t) => setTargets((prev) => [...prev, t])}
  />
))}
```

(Keep the rest of the component as-is.)

**Step 6: Run tests**

Run: `npm test`
Expected: all passing.

**Step 7: Commit**

```bash
git add .
git commit -m "feat: add redaction overlay with click-drag box drawing"
```

---

## Task 12: Redaction engine — apply + verify

**Files:**
- Create: `lib/pdf/apply.ts`, `lib/pdf/verify.ts`, `test/apply.test.ts`, `test/verify.test.ts`
- Modify: `app/app/redactor-client.tsx`

**Context:** The apply step uses pdf-lib to draw opaque rectangles over coordinates and flatten. The verify step re-opens the output with PDF.js, extracts text from every page, and fails if any target string is still present. `pdf-lib` works in PDF coord space (bottom-left origin, points); our canvas coords are top-left pixels at a scaled viewport. Conversion: `pdfY = pageHeightPts − (canvasY + canvasH) / scale`, `pdfX = canvasX / scale`, `pdfW = canvasW / scale`, `pdfH = canvasH / scale`. We read the page height and scale from the page we rendered.

**Step 1: Write failing test at `test/apply.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { applyRedactions } from '@/lib/pdf/apply';

async function makeFixture(text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 72, y: 720, size: 12, font });
  return doc.save();
}

describe('applyRedactions', () => {
  it('draws opaque black rectangles at the given PDF coords and flattens', async () => {
    const bytes = await makeFixture('Hello SSN 123-45-6789');
    const out = await applyRedactions(bytes, [
      { page: 0, x: 100, y: 714, width: 120, height: 16 },
    ]);
    expect(out.bytes.byteLength).toBeGreaterThan(0);
    expect(out.regionCount).toBe(1);
    expect(out.pageCount).toBe(1);
  });
});
```

**Step 2: Run test**

Run: `npm test -- apply`
Expected: failing.

**Step 3: Create `lib/pdf/apply.ts`**

```ts
import { PDFDocument, rgb } from 'pdf-lib';
import type { RedactionResult, RedactionTarget } from './types';

export type PdfSpaceTarget = Omit<RedactionTarget, 'text'> & { text?: string };

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function applyRedactions(
  pdfBytes: Uint8Array,
  targets: PdfSpaceTarget[]
): Promise<RedactionResult> {
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();

  for (const t of targets) {
    const page = pages[t.page];
    if (!page) continue;
    page.drawRectangle({
      x: t.x,
      y: t.y,
      width: t.width,
      height: t.height,
      color: rgb(0, 0, 0),
      opacity: 1,
    });
  }

  // flatten: pdf-lib merges drawn content on save
  const bytes = await doc.save({ useObjectStreams: false });
  return {
    bytes,
    pageCount: pages.length,
    regionCount: targets.length,
    sha256: await sha256Hex(bytes),
  };
}
```

**Step 4: Run test**

Run: `npm test -- apply`
Expected: passing.

**Step 5: Write failing test at `test/verify.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { verifyRedactions } from '@/lib/pdf/verify';

async function fixture(text: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 72, y: 720, size: 12, font });
  return doc.save();
}

describe('verifyRedactions', () => {
  it('detects when a target string is still present in the output', async () => {
    const bytes = await fixture('SSN 123-45-6789');
    const result = await verifyRedactions(bytes, ['123-45-6789']);
    expect(result.ok).toBe(false);
    expect(result.leaked).toContain('123-45-6789');
  });

  it('returns ok when no target strings are present', async () => {
    const bytes = await fixture('nothing here');
    const result = await verifyRedactions(bytes, ['secret']);
    expect(result.ok).toBe(true);
    expect(result.leaked).toEqual([]);
  });
});
```

**Step 6: Run test**

Run: `npm test -- verify`
Expected: failing.

**Step 7: Create `lib/pdf/verify.ts`**

```ts
import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export type VerifyResult = { ok: boolean; leaked: string[] };

export async function verifyRedactions(
  pdfBytes: Uint8Array,
  targetStrings: string[]
): Promise<VerifyResult> {
  if (targetStrings.length === 0) return { ok: true, leaked: [] };

  const doc = await pdfjs.getDocument({ data: pdfBytes }).promise;
  const collected: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it: any) => it.str ?? '').join(' ');
    collected.push(pageText);
  }
  const haystack = collected.join('\n');
  const leaked = targetStrings.filter((s) => haystack.includes(s));
  return { ok: leaked.length === 0, leaked };
}
```

**Step 8: Run tests**

Run: `npm test`
Expected: all passing.

**Step 9: Wire into `redactor-client.tsx`**

Add a "Redact & download" button that:
1. Converts canvas-space targets to PDF space.
2. Calls `applyRedactions`.
3. Calls `verifyRedactions` with any target `text` values (none yet for manual mode — pass `[]`, which short-circuits to `ok: true`).
4. If `ok`, triggers a download.

Inside the loaded-file branch of `redactor-client.tsx`, before the `pages.map`, add this button block:

```tsx
<button
  className="mt-2 rounded-md bg-black text-white px-4 py-2 text-sm"
  onClick={async () => {
    if (!file || !doc) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { applyRedactions } = await import('@/lib/pdf/apply');
    const { verifyRedactions } = await import('@/lib/pdf/verify');

    // Convert each canvas-space target to PDF space. Viewport scale = 1.5 (see render.ts).
    const scale = 1.5;
    const pdfTargets = await Promise.all(
      targets.map(async (t) => {
        const p = await doc.getPage(t.page + 1);
        const viewBox = p.view; // [x0, y0, x1, y1] in points
        const pageHeight = viewBox[3] - viewBox[1];
        return {
          page: t.page,
          x: t.x / scale,
          y: pageHeight - (t.y + t.height) / scale,
          width: t.width / scale,
          height: t.height / scale,
        };
      })
    );

    const result = await applyRedactions(bytes, pdfTargets);
    const verify = await verifyRedactions(result.bytes, []); // manual mode: no known strings
    if (!verify.ok) {
      alert(`Verification failed. Leaked: ${verify.leaked.join(', ')}`);
      return;
    }

    const blob = new Blob([result.bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name.replace(/\.pdf$/i, '') + '.redacted.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }}
>
  Redact &amp; download
</button>
```

**Step 10: Commit**

```bash
git add .
git commit -m "feat: redaction apply + verify pipeline with canvas→PDF coord conversion"
```

---

## Task 13: Fixture PDF corpus

**Files:**
- Create: `test/fixtures/generate.ts`, `test/fixtures/.gitignore`, `scripts/generate-fixtures.mjs`
- Modify: `package.json` (add script)

**Context:** We generate fixtures programmatically so the repo stays lean and the test corpus is reproducible. Committed: the generator. Not committed: the generated `*.pdf` files (they go in `test/fixtures/out/` which is gitignored — Playwright regenerates on demand).

**Step 1: Create `scripts/generate-fixtures.mjs`**

```js
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const outDir = 'test/fixtures/out';
mkdirSync(outDir, { recursive: true });

async function writePdf(name, build) {
  const doc = await PDFDocument.create();
  await build(doc);
  const bytes = await doc.save();
  const path = join(outDir, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  console.log('wrote', path);
}

await writePdf('plain-ssn.pdf', async (doc) => {
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Name: Jane Doe', { x: 72, y: 720, size: 12, font });
  page.drawText('SSN: 123-45-6789', { x: 72, y: 700, size: 12, font });
  page.drawText('Address: 1 Privacy Way', { x: 72, y: 680, size: 12, font });
});

await writePdf('multi-page.pdf', async (doc) => {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Page ${i + 1}`, { x: 72, y: 720, size: 14, font });
    page.drawText(`Token: SECRET-${i}`, { x: 72, y: 700, size: 12, font });
  }
});
```

**Step 2: Append to `package.json` scripts**

```json
"fixtures": "node scripts/generate-fixtures.mjs"
```

**Step 3: Create `test/fixtures/.gitignore`**

```
out/
```

**Step 4: Generate and spot-check**

```bash
npm run fixtures
ls test/fixtures/out
```

Expected: `plain-ssn.pdf`, `multi-page.pdf` present.

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add programmatic PDF fixture generator"
```

---

## Task 14: `verify-redaction` Playwright spec

**Files:**
- Create: `e2e/verify-redaction.spec.ts`

**Context:** This is the product guarantee test. Full pipeline: load fixture → draw a box over the SSN region → click "Redact & download" → intercept the download → re-parse with PDF.js → assert `123-45-6789` is absent.

**Step 1: Write `e2e/verify-redaction.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

test.beforeAll(() => {
  // Ensure fixtures exist.
  execSync('npm run fixtures', { stdio: 'inherit' });
});

test('manual redaction removes the SSN from plain-ssn.pdf', async ({ page }) => {
  await page.goto('/app');

  const fixturePath = resolve('test/fixtures/out/plain-ssn.pdf');
  await page
    .getByLabel('PDF file')
    .setInputFiles(fixturePath);

  // Wait for page canvas to render.
  const canvas = page.getByLabel('Page 1');
  await expect(canvas).toBeVisible();

  // Draw a redaction box over the SSN region.
  // Scale 1.5 × points: y=700pt → canvas y ≈ (792-700)*1.5 = 138; height 12pt → 18 canvas px
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas not positioned');
  const overlay = page.getByTestId('redaction-overlay-0');
  await overlay.dispatchEvent('mousedown', { clientX: box.x + 100, clientY: box.y + 138 });
  await overlay.dispatchEvent('mousemove', { clientX: box.x + 260, clientY: box.y + 160 });
  await overlay.dispatchEvent('mouseup',   { clientX: box.x + 260, clientY: box.y + 160 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /redact/i }).click(),
  ]);

  const savedPath = await download.path();
  if (!savedPath) throw new Error('download missing');
  const outBytes = readFileSync(savedPath);

  // Re-open with PDF.js in Node via the legacy build.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(outBytes) }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const c = await p.getTextContent();
    text += c.items.map((it: any) => it.str).join(' ') + '\n';
  }
  expect(text).not.toContain('123-45-6789');
});
```

**Step 2: Run it**

Run: `npm run e2e -- verify-redaction`
Expected: passing.

**Step 3: Commit**

```bash
git add .
git commit -m "test: add verify-redaction e2e spec (full pipeline guarantee)"
```

---

## Task 15: Final sweep

**Step 1: Run full test suite**

```bash
npm test && npm run e2e
```

Expected: all green.

**Step 2: Push the branch**

```bash
git push -u origin feat/week-1-mvp-scaffold
```

**Step 3: Open the preview URL locally**

```bash
npm run dev
```

Spot-check:
- `/` — headline, CTA, three bullets
- `/pricing` — three tiers visible, honor-system line present
- `/privacy` — schema and never-stored list rendered
- `/app` — file picker works, load `test/fixtures/out/plain-ssn.pdf`, draw a box, click "Redact & download", verify the SSN is gone in the downloaded file

**Step 4: Report outcomes**

Capture any issues in a `WEEK-1-RETRO.md` (short — what worked, what didn't, what changed from the plan). These become inputs for the Week 2 plan.
