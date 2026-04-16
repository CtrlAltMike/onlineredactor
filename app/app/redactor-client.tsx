'use client';

import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { loadPdfFromFile } from '@/lib/pdf/render';
import { PdfPageCanvas } from '@/components/pdf-page-canvas';

export function RedactorClient() {
  const [file, setFile] = useState<File | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<Awaited<ReturnType<PDFDocumentProxy['getPage']>>[]>([]);
  const [targets, setTargets] = useState<
    Array<{ page: number; x: number; y: number; width: number; height: number }>
  >([]);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let localDoc: PDFDocumentProxy | null = null;
    setPages([]);
    setDoc(null);
    setTargets([]);
    (async () => {
      const d = await loadPdfFromFile(file);
      if (cancelled) {
        d.destroy();
        return;
      }
      localDoc = d;
      setDoc(d);
      const ps: Awaited<ReturnType<PDFDocumentProxy['getPage']>>[] = [];
      for (let i = 1; i <= d.numPages; i++) {
        const p = await d.getPage(i);
        if (cancelled) return;
        ps.push(p);
      }
      if (!cancelled) setPages(ps);
    })();
    return () => {
      cancelled = true;
      if (localDoc) localDoc.destroy();
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
      <button
        className="mt-2 rounded-md bg-black text-white px-4 py-2 text-sm"
        onClick={async () => {
          if (!file || !doc) return;
          const bytes = new Uint8Array(await file.arrayBuffer());
          const { applyRedactions } = await import('@/lib/pdf/apply');
          const { verifyRedactions } = await import('@/lib/pdf/verify');

          // Convert each canvas-space target to PDF space. Viewport scale = 1.5
          // (must match PdfPageCanvas' default in lib/pdf/render.ts).
          const scale = 1.5;
          const pdfTargets = await Promise.all(
            targets.map(async (t) => {
              const p = await doc.getPage(t.page + 1);
              const viewBox = p.view; // [x0, y0, x1, y1] in points
              const pageHeight = viewBox[3] - viewBox[1];
              return {
                page: t.page,
                x: t.x / scale,
                y: pageHeight - (t.y + t.height) / scale,
                width: t.width / scale,
                height: t.height / scale,
              };
            })
          );

          const result = await applyRedactions(bytes, pdfTargets);
          // Manual mode: no known strings to check; [] short-circuits to ok.
          const verify = await verifyRedactions(result.bytes, []);
          if (!verify.ok) {
            alert(`Verification failed. Leaked: ${verify.leaked.join(', ')}`);
            return;
          }

          const blob = new Blob([new Uint8Array(result.bytes)], {
            type: 'application/pdf',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name.replace(/\.pdf$/i, '') + '.redacted.pdf';
          a.click();
          URL.revokeObjectURL(url);
        }}
      >
        Redact &amp; download
      </button>
      <div className="mt-4 space-y-4">
        {pages.map((p, i) => (
          <PdfPageCanvas
            key={`${file.name}-${i}`}
            page={p}
            pageIndex={i}
            existing={targets.filter((t) => t.page === i)}
            onCommit={(t) => setTargets((prev) => [...prev, t])}
          />
        ))}
      </div>
    </section>
  );
}
