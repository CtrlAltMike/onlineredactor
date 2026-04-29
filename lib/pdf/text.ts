import type { PDFPageProxy } from 'pdfjs-dist';

export type PdfTextItem = {
  page: number;
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type PdfTextRegion = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
};

type RawTextItem = {
  str?: string;
  width?: number;
  height?: number;
  transform?: number[];
};

type CharBox = {
  char: string;
  item: PdfTextItem;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type Pattern = {
  name: string;
  regex: RegExp;
};

const detectPatterns: Pattern[] = [
  { name: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    name: 'Email',
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    name: 'Phone',
    regex: /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g,
  },
  {
    name: 'Credit card',
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
  },
];

export function textItemFromPdfjs(
  rawItem: RawTextItem,
  page: number
): PdfTextItem | null {
  if (typeof rawItem.str !== 'string' || rawItem.str.length === 0) return null;
  const tr = rawItem.transform;
  if (!tr || tr.length < 6) return null;

  const ex = tr[4];
  const fy = tr[5];
  const w = typeof rawItem.width === 'number' ? rawItem.width : 0;
  const h = typeof rawItem.height === 'number' ? rawItem.height : 0;

  return {
    page,
    text: rawItem.str,
    x0: ex,
    y0: fy - h * 0.25,
    x1: ex + w,
    y1: fy + h * 1.1,
  };
}

export async function extractPageTextItems(
  page: PDFPageProxy,
  pageIndex: number
): Promise<PdfTextItem[]> {
  const content = await page.getTextContent();
  return (content.items as RawTextItem[])
    .map((item) => textItemFromPdfjs(item, pageIndex))
    .filter((item): item is PdfTextItem => item !== null);
}

export function overlapsPdfRegion(
  item: PdfTextItem,
  region: { page: number; x: number; y: number; width: number; height: number }
): boolean {
  if (item.page !== region.page) return false;
  const rx0 = region.x;
  const ry0 = region.y;
  const rx1 = region.x + region.width;
  const ry1 = region.y + region.height;
  return item.x0 < rx1 && item.x1 > rx0 && item.y0 < ry1 && item.y1 > ry0;
}

export function estimateCoveredText(
  item: PdfTextItem,
  rx0: number,
  rx1: number
): string {
  const chars = Array.from(item.text);
  const width = item.x1 - item.x0;
  if (width <= 0 || chars.length === 0) return item.text.trim();

  const charWidth = width / chars.length;
  const covered = chars.filter((_, index) => {
    const centerX = item.x0 + charWidth * (index + 0.5);
    return centerX >= rx0 && centerX <= rx1;
  });

  return covered.join('').trim();
}

export function coveredTextForRegions(
  items: PdfTextItem[],
  regions: Array<{ page: number; x: number; y: number; width: number; height: number }>
): string[] {
  const seeded = new Set<string>();
  for (const region of regions) {
    const rx0 = region.x;
    const rx1 = region.x + region.width;
    for (const item of items) {
      if (!overlapsPdfRegion(item, region)) continue;
      const coveredText = estimateCoveredText(item, rx0, rx1);
      if (coveredText) seeded.add(coveredText);
    }
  }
  return [...seeded];
}

export function findTextRegions(
  items: PdfTextItem[],
  query: string
): PdfTextRegion[] {
  const needle = query.trim();
  if (!needle) return [];
  return findMatchingRegions(items, new RegExp(escapeRegExp(needle), 'gi'));
}

export function detectSensitiveTextRegions(items: PdfTextItem[]): PdfTextRegion[] {
  const regions = detectPatterns.flatMap((pattern) =>
    findMatchingRegions(items, pattern.regex).map((region) => ({
      ...region,
      text: region.text || pattern.name,
    }))
  );
  return dedupeRegions(regions);
}

function findMatchingRegions(
  items: PdfTextItem[],
  pattern: RegExp
): PdfTextRegion[] {
  const byPage = new Map<number, PdfTextItem[]>();
  for (const item of items) {
    const list = byPage.get(item.page) ?? [];
    list.push(item);
    byPage.set(item.page, list);
  }

  return [...byPage.entries()].flatMap(([page, pageItems]) => {
    const chars = buildCharBoxes(pageItems);
    const text = chars.map((box) => box.char).join('');
    const regions: PdfTextRegion[] = [];
    const matcher = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    for (const match of text.matchAll(matcher)) {
      const matchText = match[0];
      const start = match.index ?? 0;
      const end = start + matchText.length;
      const matchedBoxes = chars
        .slice(start, end)
        .filter((box) => box.char.trim().length > 0);
      if (matchedBoxes.length === 0) continue;
      regions.push(regionFromCharBoxes(page, matchedBoxes, matchText));
    }
    return regions;
  });
}

function buildCharBoxes(items: PdfTextItem[]): CharBox[] {
  return items.flatMap((item, itemIndex) => {
    const chars = Array.from(item.text);
    const width = item.x1 - item.x0;
    const charWidth = chars.length > 0 ? width / chars.length : 0;
    const boxes = chars.map((char, index) => ({
      char,
      item,
      x0: item.x0 + charWidth * index,
      y0: item.y0,
      x1: item.x0 + charWidth * (index + 1),
      y1: item.y1,
    }));

    const next = items[itemIndex + 1];
    const sameLine = next && next.y0 < item.y1 && next.y1 > item.y0;
    const needsSeparator =
      next && (!sameLine || next.x0 - item.x1 > Math.max(1, item.y1 - item.y0));
    if (needsSeparator) {
      boxes.push({
        char: ' ',
        item,
        x0: item.x1,
        y0: item.y0,
        x1: item.x1,
        y1: item.y1,
      });
    }

    return boxes;
  });
}

function regionFromCharBoxes(
  page: number,
  boxes: CharBox[],
  text: string
): PdfTextRegion {
  const pad = 1;
  const x0 = Math.min(...boxes.map((box) => box.x0)) - pad;
  const y0 = Math.min(...boxes.map((box) => box.y0)) - pad;
  const x1 = Math.max(...boxes.map((box) => box.x1)) + pad;
  const y1 = Math.max(...boxes.map((box) => box.y1)) + pad;
  return {
    page,
    x: x0,
    y: y0,
    width: x1 - x0,
    height: y1 - y0,
    text,
  };
}

function dedupeRegions(regions: PdfTextRegion[]): PdfTextRegion[] {
  const seen = new Set<string>();
  return regions.filter((region) => {
    const key = [
      region.page,
      Math.round(region.x),
      Math.round(region.y),
      Math.round(region.width),
      Math.round(region.height),
      region.text,
    ].join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
