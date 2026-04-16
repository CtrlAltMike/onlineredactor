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
