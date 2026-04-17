import type { RedactionResult, RedactionTarget } from './types';

export type PdfSpaceTarget = Omit<RedactionTarget, 'text'> & { text?: string };

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy into a fresh ArrayBuffer-backed view so TS's strict
  // `BufferSource` signature (which excludes SharedArrayBuffer-backed
  // views) accepts it across TS lib versions.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const buf = await crypto.subtle.digest('SHA-256', copy);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// MuPDF boots WASM lazily; memoize the import so we don't pay the startup cost
// twice in the same process. The module is ESM-only and the single entry
// (`mupdf`) works in both Node and browser builds — `dist/mupdf.js` fetches
// `dist/mupdf-wasm.wasm` via `new URL(..., import.meta.url)` internally.
let mupdfPromise: Promise<typeof import('mupdf')> | null = null;
async function getMupdf(): Promise<typeof import('mupdf')> {
  if (!mupdfPromise) {
    // Clear the memo on failure so a transient import error (e.g. network
    // glitch fetching the WASM chunk) doesn't poison every subsequent call
    // for the life of the session.
    mupdfPromise = import('mupdf').catch((e) => {
      mupdfPromise = null;
      throw e;
    });
  }
  return mupdfPromise;
}

export async function applyRedactions(
  pdfBytes: Uint8Array,
  targets: PdfSpaceTarget[]
): Promise<RedactionResult> {
  const mupdf = await getMupdf();

  // openDocument returns a Document; asPDF() narrows it to PDFDocument.
  const generic = mupdf.Document.openDocument(pdfBytes, 'application/pdf');
  const doc = generic.asPDF();
  if (!doc) {
    throw new Error('applyRedactions: input is not a PDF');
  }

  const pageCount = doc.countPages();
  let regionCount = 0;

  try {
    // Group targets by page so we can apply redactions once per page.
    const byPage = new Map<number, PdfSpaceTarget[]>();
    for (const t of targets) {
      if (t.page < 0 || t.page >= pageCount) continue;
      const list = byPage.get(t.page) ?? [];
      list.push(t);
      byPage.set(t.page, list);
    }

    for (const [pageIndex, pageTargets] of byPage) {
      // PDFDocument overrides loadPage to return PDFPage concretely, but our
      // `doc` is typed `Document & PDFDocument` (from `asPDF()`'s intersection
      // return), and TS picks the Document signature `PDFPage | Page` out of
      // that union. We narrow explicitly — asPDF() guaranteed this is a PDF.
      const page = doc.loadPage(pageIndex) as import('mupdf').PDFPage;
      // MuPDF's JS API expects annotation rects in page display-space
      // (top-down Y, origin top-left). Confirmed via page.getTransform() ===
      // [1, 0, 0, -1, 0, pageHeight]: setRect applies the inverse transform
      // when serializing to the PDF file, so what we pass is NOT PDF-native
      // coords. Our inputs come in PDF-native (bottom-up) from the canvas→PDF
      // conversion in the UI, so we flip Y here.
      const [, , , , , pageHeight] = page.getTransform();
      for (const t of pageTargets) {
        const x0 = t.x;
        const x1 = t.x + t.width;
        // bottom-up (t.y is lower edge, t.y + t.height is upper edge)
        // → top-down: flip each around pageHeight
        const yTop = pageHeight - (t.y + t.height);
        const yBottom = pageHeight - t.y;
        const annot = page.createAnnotation('Redact');
        annot.setRect([x0, yTop, x1, yBottom]);
        regionCount += 1;
      }
      // blackBoxes: true  → paint a black rect after the content-stream rewrite
      // image_method: PIXELS (2)  → mask image pixels under the quad
      // line_art_method: REMOVE_IF_COVERED (1)  → remove vector art fully under the box
      // text_method: REMOVE (0)  → rewrite the content stream to drop glyphs
      page.applyRedactions(
        true,
        mupdf.PDFPage.REDACT_IMAGE_PIXELS,
        mupdf.PDFPage.REDACT_LINE_ART_REMOVE_IF_COVERED,
        mupdf.PDFPage.REDACT_TEXT_REMOVE
      );
    }

    const outBuffer = doc.saveToBuffer();
    // Buffer.asUint8Array() is a view onto WASM memory; copy into a fresh
    // Uint8Array so the bytes survive after the doc/buffer are destroyed.
    const view = outBuffer.asUint8Array();
    const bytes = new Uint8Array(view.byteLength);
    bytes.set(view);

    return {
      bytes,
      pageCount,
      regionCount,
      sha256: await sha256Hex(bytes),
    };
  } finally {
    doc.destroy();
  }
}
