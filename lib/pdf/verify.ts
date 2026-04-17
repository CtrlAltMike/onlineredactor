import { getPdfjs, getStandardFontDataUrl } from './render';

export type VerifyResult = { ok: boolean; leaked: string[] };

// Strip all whitespace so split-text-item false negatives (e.g. "123" + "-45-" +
// "6789" rendered as separate pdfjs items that reassemble to "123-45-6789" only
// after we concat) still match the target. Matches behavior of most "find in
// PDF" tools — whitespace between glyphs is not load-bearing for
// identity-number style targets.
function normalize(s: string): string {
  return s.replace(/\s+/g, '');
}

export async function verifyRedactions(
  pdfBytes: Uint8Array,
  targetStrings: string[]
): Promise<VerifyResult> {
  if (targetStrings.length === 0) return { ok: true, leaked: [] };

  const pdfjs = await getPdfjs();
  // Copy the input so pdfjs can safely transfer the ArrayBuffer to its worker
  // without detaching the caller's view. Without this, callers who reuse
  // `pdfBytes` after `verifyRedactions` returns (e.g. to build a download
  // Blob) hit `TypeError: Cannot perform Construct on a detached ArrayBuffer`.
  const copy = new Uint8Array(pdfBytes);
  const doc = await pdfjs.getDocument({
    data: copy,
    standardFontDataUrl: getStandardFontDataUrl(),
  }).promise;
  try {
    const collected: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // TextContent mixes TextItem (has .str) with TextMarkedContent markers
      // (no .str). Filter to the ones we can actually read.
      const pageText = (content.items as Array<Record<string, unknown>>)
        .filter(
          (it): it is { str: string } => typeof it.str === 'string'
        )
        .map((it) => it.str)
        .join('');
      collected.push(pageText);
    }
    const haystack = normalize(collected.join(''));
    const leaked = targetStrings.filter((s) =>
      haystack.includes(normalize(s))
    );
    return { ok: leaked.length === 0, leaked };
  } finally {
    await doc.destroy();
  }
}
