'use client';

import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdfFromFile } from '@/lib/pdf/render';
import { PdfPageCanvas } from '@/components/pdf-page-canvas';

export function RedactorClient() {
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<Awaited<ReturnType<PDFDocumentProxy['getPage']>>[]>([]);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    (async () => {
      const d = await loadPdfFromFile(file);
      if (cancelled) return;
      setDoc(d);
      const ps = [];
      for (let i = 1; i <= d.numPages; i++) ps.push(await d.getPage(i));
      if (!cancelled) setPages(ps);
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!file) {
    return (
      <section className="border-2 border-dashed border-neutral-300 rounded-lg p-16 text-center">
        <p className="text-lg">Drop a PDF here, or click to select.</p>
        <p className="mt-2 text-sm text-neutral-500">
          Your file is processed in your browser. It never leaves your device.
        </p>
        <input
          type="file"
          accept="application/pdf"
          aria-label="PDF file"
          className="mt-6"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
          }}
        />
      </section>
    );
  }

  return (
    <section>
      <p className="text-sm text-neutral-600">
        Loaded: {file.name} ({doc?.numPages ?? '…'} pages)
      </p>
      <div className="mt-4 space-y-4">
        {pages.map((p, i) => (
          <PdfPageCanvas key={i} page={p} pageIndex={i} />
        ))}
      </div>
    </section>
  );
}
