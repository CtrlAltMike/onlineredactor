import { describe, expect, it } from 'vitest';
import {
  buildVerificationCertificate,
  formatVerificationCertificate,
} from '@/lib/pdf/certificate';

describe('verification certificate', () => {
  it('formats a PII-free proof for a verified export', () => {
    const certificate = buildVerificationCertificate({
      generatedAt: new Date('2026-04-28T12:00:00.000Z'),
      outputSha256: 'abc123',
      pageCount: 2,
      regionCount: 3,
      verifiedStringCount: 4,
      verifiedRegionCount: 3,
    });

    const text = formatVerificationCertificate(certificate);

    expect(text).toContain('OnlineRedactor Verification Certificate');
    expect(text).toContain('Verification status: PASSED');
    expect(text).toContain('Plan: free');
    expect(text).toContain('Generated at: 2026-04-28T12:00:00.000Z');
    expect(text).toContain('Output SHA-256: abc123');
    expect(text).toContain('Redaction regions: 3');
    expect(text).toContain('Verified text seeds: 4');
    expect(text).toContain('Redacted with OnlineRedactor free build');
    expect(text).not.toContain('Jane Doe');
    expect(text).not.toContain('123-45-6789');
    expect(text).not.toContain('sample.pdf');
  });
});
