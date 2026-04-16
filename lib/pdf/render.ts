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
      if (needsLegacy) {
        // Resolve the worker relative to pdfjs-dist itself, not this file.
        const { createRequire } = await import('node:module');
        const require = createRequire(import.meta.url);
        mod.GlobalWorkerOptions.workerSrc = require.resolve(
          'pdfjs-dist/legacy/build/pdf.worker.min.mjs'
        );
      } else {
        mod.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();
      }
      return mod as typeof import('pdfjs-dist');
    })();
  }
  return pdfjsPromise;
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
