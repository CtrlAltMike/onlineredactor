import { getPdfjs, getStandardFontDataUrl } from './render';
import {
  extractPageTextItems,
  overlapsPdfRegion,
  type PdfTextItem,
} from './text';

export type VerifyResult = { ok: boolean; leaked: string[] };
export type VerifyRegion = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

// Strip all whitespace so split-text-item false negatives (e.g. "123" + "-45-" +
// "6789" rendered as separate pdfjs items that reassemble to "123-45-6789" only
// after we concat) still match the target. Matches behavior of most "find in
// PDF" tools — whitespace between glyphs is not load-bearing for
// identity-number style targets.
function normalize(s: string): string {
  return s.replace(/\s+/g, '');
}

function verificationFragments(target: string): string[] {
  const normalized = normalize(target);
  if (normalized.length === 0) return [];
  const minFragmentLength = 4;
  if (normalized.length <= minFragmentLength) return [normalized];

  const fragments = new Set<string>([normalized]);
  for (let i = 0; i <= normalized.length - minFragmentLength; i++) {
    fragments.add(normalized.slice(i, i + minFragmentLength));
  }
  return [...fragments];
}

async function extractTextBoxes(pdfBytes: Uint8Array): Promise<PdfTextItem[]> {
  const pdfjs = await getPdfjs();
  // Copy the input so pdfjs can safely transfer the ArrayBuffer to its worker
  // without detaching the caller's view.
  const copy = new Uint8Array(pdfBytes);
  const doc = await pdfjs.getDocument({
    data: copy,
    standardFontDataUrl: await getStandardFontDataUrl(),
  }).promise;
  try {
    const boxes: PdfTextItem[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      boxes.push(...(await extractPageTextItems(page, i - 1)));
    }
    return boxes;
  } finally {
    await doc.destroy();
  }
}

export async function verifyRedactions(
  pdfBytes: Uint8Array,
  targetStrings: string[]
): Promise<VerifyResult> {
  if (targetStrings.length === 0) return { ok: true, leaked: [] };

  const boxes = await extractTextBoxes(pdfBytes);
  const haystack = normalize(boxes.map((box) => box.text).join(''));
  const leaked = targetStrings.filter((target) =>
    verificationFragments(target).some((fragment) =>
      haystack.includes(fragment)
    )
  );
  return { ok: leaked.length === 0, leaked };
}

export async function verifyRedactionRegions(
  pdfBytes: Uint8Array,
  regions: VerifyRegion[]
): Promise<VerifyResult> {
  if (regions.length === 0) return { ok: true, leaked: [] };

  const boxes = await extractTextBoxes(pdfBytes);
  const leaked = boxes
    .filter((box) =>
      regions.some((region) => overlapsPdfRegion(box, region))
    )
    .map((box) => box.text)
    .filter((text, index, all) => all.indexOf(text) === index);

  return { ok: leaked.length === 0, leaked };
}
