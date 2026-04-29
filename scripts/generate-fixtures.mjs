import fontkit from '@pdf-lib/fontkit';
import * as mupdf from 'mupdf';
import {
  degrees,
  PDFDocument,
  PDFName,
  PDFString,
  StandardFonts,
  rgb,
} from 'pdf-lib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

function fontBytes(...paths) {
  const path = paths.find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error(`No fixture font found in: ${paths.join(', ')}`);
  }
  return readFileSync(path);
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
    const token = ['PAGEONE-ALPHA', 'BRAVO-91573', 'PAGETHREE-OMEGA'][i];
    page.drawText(`Token: ${token}`, { x: 72, y: 700, size: 12, font });
  }
});

await writePdf('standard-fonts.pdf', async (doc) => {
  const page = doc.addPage([612, 792]);
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  page.drawText('Standard font fixture', { x: 72, y: 720, size: 14, font: helvetica });
  page.drawText('Token: ZQXS-12345', { x: 72, y: 696, size: 12, font: times });
  page.drawText('Public note: standard fonts remain readable', {
    x: 72,
    y: 672,
    size: 12,
    font: helvetica,
  });
});

await writePdf('embedded-font.pdf', async (doc) => {
  doc.registerFontkit(fontkit);
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(
    fontBytes(
      'node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf',
      '/System/Library/Fonts/SFNSMono.ttf',
      '/System/Library/Fonts/Menlo.ttc'
    )
  );
  page.drawText('Embedded font fixture', { x: 72, y: 720, size: 14, font });
  page.drawText('Token: ZQXE-24680', { x: 72, y: 696, size: 12, font });
  page.drawText('Public note: custom embedded font survives', {
    x: 72,
    y: 672,
    size: 12,
    font,
  });
});

await writePdf('rotated-page.pdf', async (doc) => {
  const page = doc.addPage([612, 792]);
  page.setRotation(degrees(90));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Rotated page fixture', { x: 72, y: 720, size: 14, font });
  page.drawText('Token: ZQXR-13579', { x: 72, y: 696, size: 12, font });
  page.drawText('Public note: rotated page text remains', {
    x: 72,
    y: 672,
    size: 12,
    font,
  });
});

await writePdf('cropped-page.pdf', async (doc) => {
  const page = doc.addPage([612, 792]);
  page.setCropBox(36, 36, 540, 720);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Cropped page fixture', { x: 72, y: 720, size: 14, font });
  page.drawText('Token: ZQXC-86420', { x: 72, y: 696, size: 12, font });
  page.drawText('Public note: cropped page text remains', {
    x: 72,
    y: 672,
    size: 12,
    font,
  });
});

await writePdf('mixed-orientation.pdf', async (doc) => {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const portrait = doc.addPage([612, 792]);
  portrait.drawText('Mixed orientation portrait page', {
    x: 72,
    y: 720,
    size: 14,
    font,
  });
  portrait.drawText('Public note: portrait page remains', {
    x: 72,
    y: 696,
    size: 12,
    font,
  });
  const landscape = doc.addPage([792, 612]);
  landscape.drawText('Mixed orientation landscape page', {
    x: 72,
    y: 540,
    size: 14,
    font,
  });
  landscape.drawText('Token: ZQXM-97531', { x: 72, y: 516, size: 12, font });
  landscape.drawText('Public note: landscape page remains', {
    x: 72,
    y: 492,
    size: 12,
    font,
  });
});

await writePdf('non-latin.pdf', async (doc) => {
  doc.registerFontkit(fontkit);
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(
    fontBytes(
      'test/fixtures/fonts/NotoSansArmenian-Regular.ttf',
      '/System/Library/Fonts/SFArmenian.ttf',
      '/System/Library/Fonts/Supplemental/Arial Unicode.ttf'
    )
  );
  page.drawText('Non-Latin fixture', { x: 72, y: 720, size: 14, font });
  page.drawText('Գաղտնի', { x: 72, y: 696, size: 12, font });
  page.drawText('հայերեն-թեստ', {
    x: 72,
    y: 672,
    size: 12,
    font,
  });
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

await writePdf('ocr-like-image.pdf', async (doc) => {
  const page = doc.addPage([612, 792]);
  page.drawRectangle({
    x: 72,
    y: 640,
    width: 360,
    height: 110,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.98),
  });
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 18; col += 1) {
      page.drawRectangle({
        x: 96 + col * 16,
        y: 716 - row * 18,
        width: col % 5 === 0 ? 6 : 11,
        height: 8,
        color: rgb(0.12, 0.12, 0.12),
      });
    }
  }
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

await writePdf('annotation-text.pdf', async (doc) => {
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Annotation fixture', { x: 72, y: 730, size: 12, font });
  page.drawText('Visible text is not the only content in this PDF.', {
    x: 72,
    y: 706,
    size: 12,
    font,
  });
  const annotation = doc.context.obj({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Text'),
    Rect: [72, 650, 92, 670],
    Contents: PDFString.of('Hidden annotation SSN 123-45-6789'),
    Name: PDFName.of('Comment'),
    Open: false,
  });
  const annotationRef = doc.context.register(annotation);
  page.node.set(PDFName.of('Annots'), doc.context.obj([annotationRef]));
});

await writePdf('metadata-sensitive.pdf', async (doc) => {
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Metadata fixture', { x: 72, y: 730, size: 12, font });
  page.drawText('Visible page content has no sensitive pattern.', {
    x: 72,
    y: 706,
    size: 12,
    font,
  });
  doc.setTitle('Client SSN 123-45-6789');
  doc.setSubject('Hidden email jane@example.com');
  doc.setKeywords(['redaction', '4242 4242 4242 4242']);
});

await (async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Encrypted fixture', { x: 72, y: 730, size: 12, font });
  page.drawText('Token: ENCRYPTED-11223', { x: 72, y: 706, size: 12, font });
  const plainBytes = await doc.save();
  const mupdfDoc = mupdf.Document.openDocument(
    new Uint8Array(plainBytes),
    'application/pdf'
  ).asPDF();
  const encryptedBytes = mupdfDoc.saveToBuffer({
    encrypt: 'aes-256',
    'user-password': 'secret',
    'owner-password': 'owner',
  }).asUint8Array();
  const path = join(outDir, 'encrypted.pdf');
  writeFileSync(path, encryptedBytes);
  console.log('wrote', path);
})();
