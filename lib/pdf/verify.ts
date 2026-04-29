import { getPdfjs, getStandardFontDataUrl } from './render';

export type VerifyResult = { ok: boolean; leaked: string[] };
export type VerifyRegion = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type TextItem = {
  str?: string;
  width?: number;
  height?: number;
  transform?: number[];
};

type TextBox = {
  page: number;
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
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

function toTextBox(item: TextItem, page: number): TextBox | null {
  if (typeof item.str !== 'string' || item.str.length === 0) return null;
  const tr = item.transform;
  if (!tr || tr.length < 6) return null;

  const ex = tr[4];
  const fy = tr[5];
  const w = typeof item.width === 'number' ? item.width : 0;
  const h = typeof item.height === 'number' ? item.height : 0;

  return {
    page,
    text: item.str,
    x0: ex,
    y0: fy - h * 0.25,
    x1: ex + w,
    y1: fy + h * 1.1,
  };
}

function overlaps(a: TextBox, b: VerifyRegion): boolean {
  const rx0 = b.x;
  const ry0 = b.y;
  const rx1 = b.x + b.width;
  const ry1 = b.y + b.height;
  return a.x0 < rx1 && a.x1 > rx0 && a.y0 < ry1 && a.y1 > ry0;
}

async function extractTextBoxes(pdfBytes: Uint8Array): Promise<TextBox[]> {
  const pdfjs = await getPdfjs();
  // Copy the input so pdfjs can safely transfer the ArrayBuffer to its worker
  // without detaching the caller's view.
  const copy = new Uint8Array(pdfBytes);
  const doc = await pdfjs.getDocument({
    data: copy,
    standardFontDataUrl: await getStandardFontDataUrl(),
  }).promise;
  try {
    const boxes: TextBox[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      for (const rawItem of content.items as TextItem[]) {
        const box = toTextBox(rawItem, i - 1);
        if (box) boxes.push(box);
      }
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
      regions.some((region) => region.page === box.page && overlaps(box, region))
    )
    .map((box) => box.text)
    .filter((text, index, all) => all.indexOf(text) === index);

  return { ok: leaked.length === 0, leaked };
}
