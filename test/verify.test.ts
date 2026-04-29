import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { verifyRedactionRegions, verifyRedactions } from '@/lib/pdf/verify';

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

  it('detects partial leftovers from a longer target string', async () => {
    const bytes = await fixture('6789');
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

  // Lock in the short-circuit so a future refactor doesn't silently change
  // it. Callers (redactor-client) rely on this to detect the "seeded is
  // empty" case and warn the user instead of claiming vacuous success.
  it('short-circuits to ok:true when targetStrings is empty', async () => {
    const bytes = await fixture('this remains');
    const result = await verifyRedactions(bytes, []);
    expect(result).toEqual({ ok: true, leaked: [] });
  });

  it('detects extractable text still inside a redaction region', async () => {
    const bytes = await fixture('SSN 123-45-6789');
    const result = await verifyRedactionRegions(bytes, [
      { page: 0, x: 72, y: 714, width: 200, height: 18 },
    ]);
    expect(result.ok).toBe(false);
    expect(result.leaked.join('')).toContain('SSN 123-45-6789');
  });

  it('passes when extractable text is outside the redaction region', async () => {
    const bytes = await fixture('SSN 123-45-6789');
    const result = await verifyRedactionRegions(bytes, [
      { page: 0, x: 72, y: 300, width: 200, height: 18 },
    ]);
    expect(result).toEqual({ ok: true, leaked: [] });
  });
});
