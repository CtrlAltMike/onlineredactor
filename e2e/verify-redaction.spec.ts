import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

test.beforeAll(() => {
  // Ensure fixtures exist. Idempotent.
  execSync('npm run fixtures', { stdio: 'inherit' });
});

test('manual redaction removes the SSN from plain-ssn.pdf (product moat)', async ({ page }) => {
  await page.goto('/app');

  const fixturePath = resolve('test/fixtures/out/plain-ssn.pdf');
  await page.getByLabel('PDF file').setInputFiles(fixturePath);

  // Wait for the page canvas to render (PDF.js worker + rasterization).
  const canvas = page.getByLabel('Page 1');
  await expect(canvas).toBeVisible();

  // Wait for the overlay to mount (the component only renders it once the
  // canvas has reported its dimensions via setDims).
  const overlay = page.getByTestId('redaction-overlay-0');
  await expect(overlay).toBeVisible();

  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('canvas has no bounding box');

  // Cover the SSN line. Coordinate derivation:
  //   Page size: 612x792 pt. Canvas render scale: 1.5 → canvas 918x1188 px.
  //   Text lines (all 12pt Helvetica, drawn by pdf-lib):
  //     "Name: Jane Doe"          PDF (72, 720) → canvas baseline y=108
  //     "SSN: 123-45-6789"        PDF (72, 700) → canvas baseline y=138
  //     "Address: 1 Privacy Way"  PDF (72, 680) → canvas baseline y=168
  //
  //   The redactor's seeding pass (redactor-client.tsx) pads each text item's
  //   AABB by h*1.1 above baseline to catch ascenders/diacritics. For 12pt,
  //   that puts each line's "seed zone" roughly ±13pt around the baseline,
  //   which in canvas space is ±20px. So to seed ONLY the SSN line we need
  //   the box to stay clear of the Name seed zone (canvas y < ~118 in PDF
  //   terms ≈ canvas y > 113 from top) and the Address seed zone (canvas y >
  //   ~148). A box at canvas y=120–144 seeds only SSN and still comfortably
  //   covers the visible glyphs (caps top ~120, baseline 138, descender ~143).
  //   X range starts before "SSN:" (PDF x=72 → canvas x=108) and runs past
  //   "6789".
  const x0 = canvasBox.x + 90;
  const y0 = canvasBox.y + 120;
  const x1 = canvasBox.x + 420;
  const y1 = canvasBox.y + 144;

  await page.mouse.move(x0, y0);
  await page.mouse.down();
  // Playwright recommends an intermediate move step so drag gestures register.
  await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 });
  await page.mouse.move(x1, y1, { steps: 4 });
  await page.mouse.up();

  // Trigger redact + download. Accept any alert dialogs (empty-seeded warning
  // would surface here if seeding failed; the test should still fail on leak).
  page.on('dialog', (d) => d.accept());

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /redact/i }).click(),
  ]);

  const savedPath = await download.path();
  if (!savedPath) throw new Error('download did not produce a path');
  const outBytes = readFileSync(savedPath);

  // Re-open with pdfjs-dist legacy build in Node; extract text from every page.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as typeof import('pdfjs-dist');
  // pdfjs needs a file:// URL to the bundled standard-font fallbacks. Resolve
  // from CWD (Playwright launches from the project root) rather than
  // import.meta.url, which forces Playwright's ESM transform and breaks the
  // Node-builtin `require` stubs in this spec file.
  const standardFontDataUrl =
    'file://' + resolve('node_modules/pdfjs-dist/standard_fonts') + '/';
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(outBytes),
    standardFontDataUrl,
  }).promise;

  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const c = await p.getTextContent();
    text += c.items
      .filter((it: unknown): it is { str: string } =>
        typeof (it as { str?: unknown }).str === 'string'
      )
      .map((it) => it.str)
      .join(' ') + '\n';
  }

  // Whitespace-normalize before assertion to avoid split-text-item false positives.
  const haystack = text.replace(/\s+/g, '');
  expect(haystack).not.toContain('123-45-6789');

  // Also assert that the unredacted neighbors survived — confirms the redaction
  // was targeted, not a wholesale page wipe.
  expect(haystack).toContain('JaneDoe');
  expect(haystack).toContain('PrivacyWay');
});
