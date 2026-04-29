import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  MAX_PDF_FILE_BYTES,
  pdfSizeLimitMessage,
} from '@/lib/pdf/limits';

describe('PDF limits', () => {
  it('formats byte values for user-facing errors', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB');
  });

  it('allows files at the Phase 1 size limit', () => {
    expect(pdfSizeLimitMessage(MAX_PDF_FILE_BYTES)).toBeNull();
  });

  it('blocks files above the Phase 1 size limit', () => {
    expect(pdfSizeLimitMessage(MAX_PDF_FILE_BYTES + 1)).toMatch(/above the 50 MB/i);
  });
});
