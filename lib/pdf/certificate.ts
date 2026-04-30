export type VerificationCertificate = {
  appName: 'OnlineRedactor';
  certificateVersion: 1;
  generatedAt: string;
  result: 'passed';
  plan: 'free';
  outputSha256: string;
  pageCount: number;
  regionCount: number;
  verifiedStringCount: number;
  verifiedRegionCount: number;
  watermark: string;
  method: string;
  limitations: string[];
};

export type VerificationCertificateInput = {
  generatedAt?: Date;
  outputSha256: string;
  pageCount: number;
  regionCount: number;
  verifiedStringCount: number;
  verifiedRegionCount: number;
};

export function buildVerificationCertificate(
  input: VerificationCertificateInput
): VerificationCertificate {
  return {
    appName: 'OnlineRedactor',
    certificateVersion: 1,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    result: 'passed',
    plan: 'free',
    outputSha256: input.outputSha256,
    pageCount: input.pageCount,
    regionCount: input.regionCount,
    verifiedStringCount: input.verifiedStringCount,
    verifiedRegionCount: input.verifiedRegionCount,
    watermark: 'Redacted with OnlineRedactor free build',
    method:
      'Redactions applied with MuPDF content-stream redaction, then verified by reopening the output and checking both seeded text fragments and redacted regions with PDF.js.',
    limitations: [
      'Certificate covers extractable PDF page text and redaction regions verified by this browser session.',
      'PDFs with scanned-only pages, fillable forms, document JavaScript, unsupported annotations, or embedded attachments are blocked before export.',
      'The original PDF, filenames, redaction coordinates, and redacted strings are not included in this certificate.',
    ],
  };
}

export function formatVerificationCertificate(
  certificate: VerificationCertificate
): string {
  return [
    'OnlineRedactor Verification Certificate',
    `Certificate version: ${certificate.certificateVersion}`,
    `Generated at: ${certificate.generatedAt}`,
    `Verification status: ${certificate.result.toUpperCase()}`,
    `Plan: ${certificate.plan}`,
    `Output SHA-256: ${certificate.outputSha256}`,
    `Page count: ${certificate.pageCount}`,
    `Redaction regions: ${certificate.regionCount}`,
    `Verified text seeds: ${certificate.verifiedStringCount}`,
    `Verified regions: ${certificate.verifiedRegionCount}`,
    `Watermark: ${certificate.watermark}`,
    '',
    'Method:',
    certificate.method,
    '',
    'Limitations:',
    ...certificate.limitations.map((limitation) => `- ${limitation}`),
  ].join('\n');
}
