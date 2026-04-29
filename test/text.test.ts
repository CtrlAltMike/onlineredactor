import { describe, expect, it } from 'vitest';
import {
  coveredTextForRegions,
  detectSensitiveTextRegions,
  findTextRegions,
  type PdfTextItem,
} from '@/lib/pdf/text';

function item(text: string, x0: number, y0 = 100): PdfTextItem {
  return {
    page: 0,
    text,
    x0,
    y0,
    x1: x0 + text.length * 6,
    y1: y0 + 12,
  };
}

describe('PDF text targeting', () => {
  it('finds exact text regions for search mode', () => {
    const regions = findTextRegions(
      [item('Name: Jane Doe', 72), item('SSN: 123-45-6789', 72, 80)],
      '123-45-6789'
    );

    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ page: 0, text: '123-45-6789' });
    expect(regions[0].width).toBeGreaterThan(0);
  });

  it('detects sensitive text patterns', () => {
    const regions = detectSensitiveTextRegions([
      item('Email: jane@example.com', 72),
      item('Phone: 555-123-4567', 72, 80),
      item('Card: 4242 4242 4242 4242', 72, 60),
    ]);

    expect(regions.map((region) => region.text)).toEqual(
      expect.arrayContaining([
        'jane@example.com',
        '555-123-4567',
        '4242 4242 4242 4242',
      ])
    );
  });

  it('seeds only the text covered by a region', () => {
    const seeded = coveredTextForRegions([item('SSN: 123-45-6789', 72)], [
      { page: 0, x: 102, y: 95, width: 70, height: 20 },
    ]);

    expect(seeded.join('')).toContain('123-45');
    expect(seeded.join('')).not.toContain('SSN');
  });
});
