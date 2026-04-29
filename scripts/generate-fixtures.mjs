import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
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

await writePdf('patterns.pdf', async (doc) => {
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Client: Jane Doe', { x: 72, y: 720, size: 12, font });
  page.drawText('Email: jane@example.com', { x: 72, y: 700, size: 12, font });
  page.drawText('Phone: 555-123-4567', { x: 72, y: 680, size: 12, font });
  page.drawText('Card: 4242 4242 4242 4242', { x: 72, y: 660, size: 12, font });
  page.drawText('Public note: keep this line', { x: 72, y: 640, size: 12, font });
});

await writePdf('scanned-image-only.pdf', async (doc) => {
  const page = doc.addPage([612, 792]);
  page.drawRectangle({
    x: 72,
    y: 650,
    width: 300,
    height: 80,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    color: rgb(0.95, 0.95, 0.95),
  });
  // This fixture intentionally contains no PDF text objects. It represents the
  // class of scanned/image-only PDFs that V1 must detect and block until OCR.
  page.drawRectangle({
    x: 110,
    y: 690,
    width: 220,
    height: 8,
    color: rgb(0.2, 0.2, 0.2),
  });
});

await writePdf('form-field.pdf', async (doc) => {
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Form field fixture', { x: 72, y: 730, size: 12, font });
  page.drawText('Visible label: SSN', { x: 72, y: 700, size: 12, font });
  const form = doc.getForm();
  const field = form.createTextField('ssn');
  field.setText('123-45-6789');
  field.addToPage(page, { x: 170, y: 692, width: 140, height: 22 });
});
