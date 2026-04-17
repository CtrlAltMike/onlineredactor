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
      // Worker resolution is environment-specific:
      //   * Browser (Turbopack/Webpack): `new URL(bareSpecifier, import.meta.url)`
      //     is the canonical bundler asset-reference form. The bundler emits
      //     the worker and rewrites the URL at build time.
      //   * Node / Vitest (jsdom): `import.meta.url` resolves to
      //     `http://localhost/...` (jsdom pretends to be a browser), so
      //     `new URL('pdfjs-dist/...', importMetaUrl)` yields an http URL
      //     that pdfjs then can't fetch from disk. Use `createRequire` + the
      //     package's `exports` to get a real filesystem path → file:// URL.
      //
      // An earlier revision used `import.meta.resolve(...)` in all paths,
      // but Turbopack's runtime shim doesn't implement `.resolve` — broke
      // browser loading. And a pure `new URL(...)` path regresses vitest.
      if (needsLegacy) {
        const { createRequire } = await import('node:module');
        const req = createRequire(import.meta.url);
        mod.GlobalWorkerOptions.workerSrc = req.resolve(
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

// pdfjs needs a URL to the bundled CFF/OpenType fallbacks for the 14 standard
// PDF fonts (Helvetica, Times-Roman, …). Without this, real-world PDFs that
// reference standard fonts without embedding them emit "Ensure that the
// standardFontDataUrl API parameter is provided" warnings and may fail text
// extraction silently — which would make verifyRedactions report a false
// `ok: true`.
//
// Environment split:
//   * Node (Vitest, CI, fixture generation): resolve the on-disk package
//     directory via `createRequire` + `require.resolve('pdfjs-dist/package.json')`
//     and return a file:// URL to the adjacent `standard_fonts/` directory.
//   * Browser: we don't ship the standard fonts (~800 KB) in the public
//     bundle because the fixtures we care about embed their own fonts. We
//     still pass a URL (pdfjs complains without one) but point at a
//     same-origin path; the fetch only happens if pdfjs actually needs a
//     standard font — our embedded-Helvetica fixture doesn't.
//
// The `node:module` dynamic import below runs only when `window` is
// undefined (Node). Turbopack's static analyzer still sees the import
// specifier; `next.config.ts` aliases `module` to an empty-stub for the
// browser bundle so resolution doesn't fail, and the runtime branch is
// unreachable there anyway.
//
// Earlier revisions used `import.meta.resolve(...)` / bare-specifier
// `new URL(..., import.meta.url)` — the first has no runtime implementation
// in Turbopack, the second yields an http URL under vitest/jsdom that pdfjs
// can't fetch from disk.
export async function getStandardFontDataUrl(): Promise<string> {
  if (typeof window === 'undefined') {
    const { createRequire } = await import('node:module');
    const req = createRequire(import.meta.url);
    const pkgJsonPath = req.resolve('pdfjs-dist/package.json');
    const fontsDir = pkgJsonPath.replace(/package\.json$/, 'standard_fonts/');
    return 'file://' + fontsDir;
  }
  return new URL('/pdfjs-standard-fonts/', window.location.origin).toString();
}

export async function loadPdfFromFile(file: File): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  const buffer = await file.arrayBuffer();
  return pdfjs.getDocument({ data: buffer }).promise;
}

export type RenderHandle = {
  done: Promise<{ viewportWidth: number; viewportHeight: number }>;
  cancel: () => void;
};

// Kick off a render without awaiting — returns the in-flight task so the
// caller can cancel it on unmount/re-render. React StrictMode double-invokes
// effects in dev, so a component that starts a render, is unmounted, and is
// immediately remounted on the same <canvas> will trip pdfjs' "Cannot use the
// same canvas during multiple render() operations" guard unless the first
// task is cancelled first.
export function startRenderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale = 1.5
): RenderHandle {
  const viewport = page.getViewport({ scale });
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const task = page.render({ canvasContext: ctx, canvas, viewport });
  return {
    done: task.promise.then(() => ({
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    })),
    cancel: () => task.cancel(),
  };
}

// Back-compat wrapper: awaits the render. Prefer `startRenderPage` in React
// components that may unmount mid-render.
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
