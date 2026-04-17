import { PDFDocument, StandardFonts } from 'pdf-lib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const outDir = 'test/fixtures/out';
mkdirSync(outDir, { recursive: true });

async function writePdf(name, build) {
  const doc = await PDFDocument.create();
  await build(doc);
  const bytes = await doc.save();
  const path = join(outDir, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  console.log('wrote', path);
}

await writePdf('plain-ssn.pdf', async (doc) => {
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Name: Jane Doe', { x: 72, y: 720, size: 12, font });
  page.drawText('SSN: 123-45-6789', { x: 72, y: 700, size: 12, font });
  page.drawText('Address: 1 Privacy Way', { x: 72, y: 680, size: 12, font });
});

await writePdf('multi-page.pdf', async (doc) => {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Page ${i + 1}`, { x: 72, y: 720, size: 14, font });
    page.drawText(`Token: SECRET-${i}`, { x: 72, y: 700, size: 12, font });
  }
});
