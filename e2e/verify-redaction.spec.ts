import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

test.describe.configure({ mode: 'serial' });

const supportedFixtures = [
  {
    name: 'plain-ssn.pdf',
    query: '123-45-6789',
    absent: '123-45-6789',
    present: ['JaneDoe', 'PrivacyWay'],
  },
  {
    name: 'multi-page.pdf',
    query: 'BRAVO-91573',
    absent: 'BRAVO-91573',
    present: ['PAGEONE-ALPHA', 'PAGETHREE-OMEGA'],
  },
  {
    name: 'standard-fonts.pdf',
    query: 'ZQXS-12345',
    absent: 'ZQXS-12345',
    present: ['standardfontsremainreadable'],
  },
  {
    name: 'embedded-font.pdf',
    query: 'ZQXE-24680',
    absent: 'ZQXE-24680',
    present: ['Embeddedfontfixture'],
  },
  {
    name: 'rotated-page.pdf',
    query: 'ZQXR-13579',
    absent: 'ZQXR-13579',
    present: ['rotatedpagetextremains'],
  },
  {
    name: 'cropped-page.pdf',
    query: 'ZQXC-86420',
    absent: 'ZQXC-86420',
    present: ['croppedpagetextremains'],
  },
  {
    name: 'mixed-orientation.pdf',
    query: 'ZQXM-97531',
    absent: 'ZQXM-97531',
    present: ['portraitpageremains', 'landscapepageremains'],
  },
  {
    name: 'non-latin.pdf',
    query: 'Գաղտնի',
    absent: 'Գաղտնի',
    present: ['հայերեն'],
  },
];

const blockedFixtures = [
  {
    name: 'form-field.pdf',
    alert: /fillable form fields/i,
    pageVisible: true,
  },
  {
    name: 'annotation-text.pdf',
    alert: /annotations/i,
    pageVisible: true,
  },
  {
    name: 'metadata-sensitive.pdf',
    alert: /document metadata/i,
    pageVisible: true,
  },
  {
    name: 'encrypted.pdf',
    alert: /encrypted or password-protected/i,
    pageVisible: false,
  },
  {
    name: 'scanned-image-only.pdf',
    alert: /scanned or image-only/i,
    pageVisible: true,
  },
  {
    name: 'ocr-like-image.pdf',
    alert: /scanned or image-only/i,
    pageVisible: true,
  },
];

test.beforeAll(() => {
  execSync('npm run fixtures', { stdio: 'inherit' });
});

test('manual redaction removes the SSN from plain-ssn.pdf', async ({ page }) => {
  await loadFixture(page, 'plain-ssn.pdf');

  const canvas = page.getByLabel('Page 1');
  await canvas.scrollIntoViewIfNeeded();
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('canvas has no bounding box');

  const x0 = canvasBox.x + 90;
  const y0 = canvasBox.y + 120;
  const x1 = canvasBox.x + 420;
  const y1 = canvasBox.y + 144;

  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 });
  await page.mouse.move(x1, y1, { steps: 4 });
  await page.mouse.up();

  const text = await redactAndExtractText(page);
  const haystack = text.replace(/\s+/g, '');
  expect(haystack).not.toContain('123-45-6789');
  expect(haystack).toContain('JaneDoe');
  expect(haystack).toContain('PrivacyWay');
});

test('search mode marks and redacts matching text', async ({ page }) => {
  await loadFixture(page, 'plain-ssn.pdf');

  await page.getByLabel(/find text/i).fill('123-45-6789');
  await page.getByRole('button', { name: /mark matches/i }).click();
  await expect(page.getByText(/added 1 search target/i)).toBeVisible();

  const text = await redactAndExtractText(page);
  const haystack = text.replace(/\s+/g, '');
  expect(haystack).not.toContain('123-45-6789');
  expect(haystack).toContain('JaneDoe');
  expect(haystack).toContain('PrivacyWay');
  await expect(page.getByText(/1 page, 1 region, SHA-256/i)).toBeVisible();
});

for (const fixture of supportedFixtures) {
  test(`fixture corpus exports verified redaction for ${fixture.name}`, async ({ page }) => {
    await loadFixture(page, fixture.name);

    await page.getByLabel(/find text/i).fill(fixture.query);
    await page.getByRole('button', { name: /mark matches/i }).click();
    await expect(page.getByText(/added .* search target/i)).toBeVisible();

    const text = await redactAndExtractText(page);
    const haystack = text.replace(/\s+/g, '');
    expect(haystack).not.toContain(fixture.absent);
    for (const present of fixture.present) {
      expect(haystack).toContain(present);
    }
  });
}

test('saved local rules can mark matching text', async ({ page }) => {
  await loadFixture(page, 'plain-ssn.pdf');

  await page.getByLabel(/find text/i).fill('123-45-6789');
  await page.getByRole('button', { name: /save rule/i }).click();
  await expect(page.getByText(/saved "123-45-6789"/i)).toBeVisible();
  await page.getByRole('button', { name: /^apply$/i }).click();

  await expect(page.getByText(/1 target selected/i)).toBeVisible();
});

test('auto-detect mode redacts supported sensitive patterns', async ({ page }) => {
  await loadFixture(page, 'patterns.pdf');

  await page.getByRole('button', { name: /auto-detect/i }).click();
  await expect(page.getByText(/auto-detect target/i)).toBeVisible();

  const text = await redactAndExtractText(page);
  const haystack = text.replace(/\s+/g, '');
  expect(haystack).not.toContain('jane@example.com');
  expect(haystack).not.toContain('555-123-4567');
  expect(haystack).not.toContain('4242424242424242');
  expect(haystack).toContain('JaneDoe');
  expect(haystack).toContain('Publicnote:keepthisline');
});

test('image-only PDFs are detected and blocked', async ({ page }) => {
  await loadFixture(page, 'scanned-image-only.pdf');

  await expect(page.getByText(/scanned or image-only/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /redact/i })).toBeDisabled();
  await expect(page.getByRole('button', { name: /auto-detect/i })).toBeDisabled();
});

for (const fixture of blockedFixtures) {
  test(`fixture corpus blocks unsupported file ${fixture.name}`, async ({ page }) => {
    await uploadFixture(page, fixture.name);
    if (fixture.pageVisible) {
      await expect(page.getByLabel('Page 1')).toBeVisible();
    }
    await expect(page.getByText(fixture.alert)).toBeVisible();
    await expect(page.getByRole('button', { name: /redact/i })).toBeDisabled();
  });
}

test('fillable form PDFs are detected and blocked', async ({ page }) => {
  await loadFixture(page, 'form-field.pdf');

  await expect(page.getByText(/fillable form fields/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /redact/i })).toBeDisabled();
});

test('local free-tier cap blocks export after three redactions', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    window.localStorage.setItem(
      'onlineredactor.free-usage.v1',
      JSON.stringify({ date, count: 3 })
    );
  });
  await loadFixture(page, 'plain-ssn.pdf');

  await expect(page.getByText(/free redactions today: 3\/3/i)).toBeVisible();
  await expect(page.getByText(/exports are paused/i)).toBeVisible();
  const capDialog = page.getByRole('dialog', { name: /free redactions paused/i });
  await expect(capDialog).toBeVisible();
  await expect(capDialog.getByRole('link', { name: /upgrade options/i })).toHaveAttribute(
    'href',
    '/upgrade'
  );
  await expect(page.getByRole('button', { name: /redact/i })).toBeDisabled();
});

test('mocked Pro account bypasses the local free-tier cap', async ({ page }) => {
  await page.route('**/api/account', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ isPro: true }),
    });
  });
  await page.route('**/api/usage/redaction', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.goto('/');
  await page.evaluate(() => {
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    window.localStorage.setItem(
      'onlineredactor.free-usage.v1',
      JSON.stringify({ date, count: 3 })
    );
  });
  await loadFixture(page, 'plain-ssn.pdf');

  await expect(page.getByText(/pro plan: unlimited verified exports/i)).toBeVisible();
  await page.getByLabel(/find text/i).fill('123-45-6789');
  await page.getByRole('button', { name: /mark matches/i }).click();
  const text = await redactAndExtractText(page);

  expect(text.replace(/\s+/g, '')).not.toContain('123-45-6789');
});

async function loadFixture(page: Page, fixtureName: string) {
  await uploadFixture(page, fixtureName);
  await expect(page.getByLabel('Page 1')).toBeVisible();
}

async function uploadFixture(page: Page, fixtureName: string) {
  await page.goto('/app');
  const fixturePath = resolve('test/fixtures/out', fixtureName);
  await page.getByLabel('PDF file').setInputFiles(fixturePath);
}

async function redactAndExtractText(page: Page): Promise<string> {
  const resultPromise = Promise.race([
    page.waitForEvent('download').then((download) => ({ download })),
    page
      .waitForEvent('dialog')
      .then(async (dialog) => {
        const dialogMessage = dialog.message();
        await dialog.accept();
        return { dialogMessage };
      }),
  ]);
  await page.getByRole('button', { name: /redact/i }).click();
  const result = await resultPromise;

  if ('dialogMessage' in result) {
    throw new Error(result.dialogMessage);
  }

  const { download } = result;

  const savedPath = await download.path();
  if (!savedPath) throw new Error('download did not produce a path');
  return extractText(readFileSync(savedPath));
}

async function extractText(bytes: Uint8Array): Promise<string> {
  const pdfjs = (await import(
    'pdfjs-dist/legacy/build/pdf.mjs'
  )) as typeof import('pdfjs-dist');
  const standardFontDataUrl =
    'file://' + resolve('node_modules/pdfjs-dist/standard_fonts') + '/';
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl,
  }).promise;

  let text = '';
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i);
      const c = await p.getTextContent();
      text +=
        c.items
          .filter((it: unknown): it is { str: string } =>
            typeof (it as { str?: unknown }).str === 'string'
          )
          .map((it) => it.str)
          .join(' ') + '\n';
    }
  } finally {
    await doc.destroy();
  }

  return text;
}
