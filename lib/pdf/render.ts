'use client';

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// pdfjs-dist evaluates browser-only globals (DOMMatrix, etc.) at module load
// time, so we can't import it eagerly: Next SSRs client components for the
// initial HTML, and vitest's jsdom env also chokes. Import lazily and pin the
// worker on first use. The `.mjs` worker lets bundlers resolve it from the
// pdfjs-dist package.
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
export async function getPdfjs() {
  if (!pdfjsPromise) {
    // The main build evaluates `DOMMatrix` at module load. Real browsers have
    // it; Node/jsdom (our test env) does not. Fall back to the legacy build
    // when that global is missing so `verify.ts` can run under Vitest.
    const needsLegacy = typeof globalThis.DOMMatrix === 'undefined';
    pdfjsPromise = (async () => {
      const mod = needsLegacy
        ? await import('pdfjs-dist/legacy/build/pdf.mjs')
        : await import('pdfjs-dist');
      // Resolve the worker via `import.meta.resolve` — the ESM-standard API
      // for bare-specifier resolution, available unflagged in Node 20.6+ and
      // bundler-friendly (Turbopack/Webpack statically analyze the specifier
      // string). This replaces the earlier `createRequire('node:module')`
      // path, which Turbopack's static analyzer flagged as unresolvable in
      // the client graph.
      const workerSpec = needsLegacy
        ? 'pdfjs-dist/legacy/build/pdf.worker.min.mjs'
        : 'pdfjs-dist/build/pdf.worker.min.mjs';
      mod.GlobalWorkerOptions.workerSrc = import.meta.resolve(workerSpec);
      return mod as typeof import('pdfjs-dist');
    })();
  }
  return pdfjsPromise;
}

// pdfjs needs a URL to the bundled CFF/OpenType fallbacks for the 14 standard
// PDF fonts (Helvetica, Times-Roman, …). Without this, real-world PDFs that
// reference standard fonts without embedding them emit "Ensure that the
// standardFontDataUrl API parameter is provided" warnings and may fail text
// extraction silently — which would make verifyRedactions report a false
// `ok: true`. `import.meta.resolve` with a trailing slash returns a `file://`
// (Node) or bundler-emitted URL (browser), both of which pdfjs can `fetch()`.
export function getStandardFontDataUrl(): string {
  return import.meta.resolve('pdfjs-dist/standard_fonts/');
}

export async function loadPdfFromFile(file: File): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
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
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  return { viewportWidth: viewport.width, viewportHeight: viewport.height };
}
