// @vitest-environment node
// MuPDF WASM and PDF.js both work cleaner in Node than jsdom for parsing;
// we're exercising the redaction engine + re-extraction end-to-end here.
import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { applyRedactions } from '@/lib/pdf/apply';
import { verifyRedactions } from '@/lib/pdf/verify';

async function fixture(text: string, textY = 720): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 72, y: textY, size: 12, font });
  return doc.save();
}

describe('applyRedactions (true content-stream redaction)', () => {
  it('removes underlying text — round-trip proves the string is gone', async () => {
    // Fixture: "SSN 123-45-6789" drawn at x=72, y=720. 12pt Helvetica.
    // A box that covers the SSN in PDF space (bottom-left origin, points).
    const input = await fixture('SSN 123-45-6789');
    // Cover the full line at y~720, height big enough to catch ascenders/descenders.
    const result = await applyRedactions(input, [
      { page: 0, x: 72, y: 714, width: 200, height: 18 },
    ]);

    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(result.pageCount).toBe(1);
    expect(result.regionCount).toBe(1);

    // The actual guarantee: verify the string is absent from the output.
    const verify = await verifyRedactions(result.bytes, ['123-45-6789']);
    expect(verify.ok).toBe(true);
    expect(verify.leaked).toEqual([]);
  });

  it('returns a distinct document (bytes change) after redaction', async () => {
    const input = await fixture('Something to redact');
    const result = await applyRedactions(input, [
      { page: 0, x: 72, y: 714, width: 300, height: 18 },
    ]);
    expect(result.bytes.byteLength).not.toBe(input.byteLength);
  });

  it('passes through when targets is empty (no-op is safe)', async () => {
    const input = await fixture('nothing touched');
    const result = await applyRedactions(input, []);
    expect(result.regionCount).toBe(0);
    const verify = await verifyRedactions(result.bytes, ['nothing touched']);
    // No redaction applied, so text survives — verify reports it present.
    expect(verify.ok).toBe(false);
  });
});
