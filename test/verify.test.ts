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
