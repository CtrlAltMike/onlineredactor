import { PDFDocument, rgb } from 'pdf-lib';
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
