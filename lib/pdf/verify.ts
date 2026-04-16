import { getPdfjs } from './render';

export type VerifyResult = { ok: boolean; leaked: string[] };

export async function verifyRedactions(
  pdfBytes: Uint8Array,
  targetStrings: string[]
): Promise<VerifyResult> {
  if (targetStrings.length === 0) return { ok: true, leaked: [] };

  const pdfjs = await getPdfjs();
  const doc = await pdfjs.getDocument({ data: pdfBytes }).promise;
  try {
    const collected: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((it: unknown) => (it as { str?: string }).str ?? '')
        .join(' ');
      collected.push(pageText);
    }
    const haystack = collected.join('\n');
    const leaked = targetStrings.filter((s) => haystack.includes(s));
    return { ok: leaked.length === 0, leaked };
  } finally {
    await doc.destroy();
  }
}
