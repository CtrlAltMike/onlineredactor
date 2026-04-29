export const MAX_PDF_FILE_BYTES = 50 * 1024 * 1024;

export function pdfSizeLimitMessage(
  fileSize: number,
  maxBytes = MAX_PDF_FILE_BYTES
): string | null {
  if (fileSize <= maxBytes) return null;
  return `This PDF is ${formatBytes(fileSize)}, which is above the ${formatBytes(
    maxBytes
  )} Phase 1 browser limit. Large PDFs can hang the tab, so upload is blocked for now.`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = unitIndex === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}
