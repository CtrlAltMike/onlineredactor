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
          try {
            if (!file || !doc) return;
            const bytes = new Uint8Array(await file.arrayBuffer());
            const { applyRedactions } = await import('@/lib/pdf/apply');
            const { verifyRedactions } = await import('@/lib/pdf/verify');

            // Convert each canvas-space target to PDF space. Viewport scale = 1.5
            // (must match PdfPageCanvas' default in lib/pdf/render.ts).
            // While we're there, extract the text items the target overlaps so
            // we can feed them to verifyRedactions as the post-redaction
            // contract ("these strings must NOT survive").
            const scale = 1.5;
            const seeded: string[] = [];
            const pdfTargets = await Promise.all(
              targets.map(async (t) => {
                const p = await doc.getPage(t.page + 1);
                const viewBox = p.view; // [x0, y0, x1, y1] in points
                const pageHeight = viewBox[3] - viewBox[1];
                const pdfRect = {
                  x: t.x / scale,
                  y: pageHeight - (t.y + t.height) / scale,
                  width: t.width / scale,
                  height: t.height / scale,
                };
                // Collect text items whose PDF-space AABB intersects pdfRect.
                // pdfjs text items carry a 2D transform [a,b,c,d,e,f]; for
                // horizontal text e is x-origin, f is y-baseline, and the item
                // occupies roughly [e, f, e+width, f+height]. Err on the side
                // of false positives — we'd rather claim a nearby string is
                // being redacted than silently miss it.
                const tc = await p.getTextContent();
                const rx0 = pdfRect.x;
                const ry0 = pdfRect.y;
                const rx1 = pdfRect.x + pdfRect.width;
                const ry1 = pdfRect.y + pdfRect.height;
                for (const rawItem of tc.items) {
                  const it = rawItem as {
                    str?: string;
                    width?: number;
                    height?: number;
                    transform?: number[];
                  };
                  if (typeof it.str !== 'string' || it.str.length === 0) continue;
                  const tr = it.transform;
                  if (!tr || tr.length < 6) continue;
                  const ex = tr[4];
                  const fy = tr[5];
                  const w = typeof it.width === 'number' ? it.width : 0;
                  const h = typeof it.height === 'number' ? it.height : 0;
                  // fy is the baseline; descenders (g, j, p, q, y) extend below
                  // and ascenders/diacritics can overshoot the reported height.
                  // Pad the AABB so glyphs at the edge of the redaction box
                  // still register as overlapping.
                  const ix0 = ex;
                  const iy0 = fy - h * 0.25;
                  const ix1 = ex + w;
                  const iy1 = fy + h * 1.1;
                  const overlaps =
                    ix0 < rx1 && ix1 > rx0 && iy0 < ry1 && iy1 > ry0;
                  if (overlaps) seeded.push(it.str);
                }
                return { page: t.page, ...pdfRect };
              })
            );

            const result = await applyRedactions(bytes, pdfTargets);

            // Week-1 policy for the empty-seeded case: when the user drew a
            // box over something pdfjs couldn't extract text from (image-only
            // region, CID font without ToUnicode, scanned page), `seeded` is
            // empty and `verifyRedactions` would trivially return ok:true —
            // a vacuous guarantee. apply DID rewrite the content stream and
            // paint the black box, so the file is safe; we just can't prove
            // it automatically. Warn the user honestly and still allow the
            // download. (The alternative — blocking until we build a
            // "text-inside-region" post-check — is deferred to a later week.)
            if (targets.length > 0 && seeded.length === 0) {
              alert(
                "We couldn't extract text from the region you redacted before applying. MuPDF rewrote the content stream (the black rectangle is real), but we can't automatically verify it's clean. Please visually confirm the exported PDF before sharing it."
              );
            } else {
              // Seeded targets: MuPDF should have scrubbed these from the
              // content stream. If verify finds any, hard-fail the export so
              // the user knows something slipped through.
              const verify = await verifyRedactions(result.bytes, seeded);
              if (!verify.ok) {
                alert(
                  `Verification failed — redaction did not remove the following text, so the file was NOT downloaded:\n\n${verify.leaked.join(
                    '\n'
                  )}`
                );
                return;
              }
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
          } catch (e) {
            alert(
              `Redaction failed: ${
                e instanceof Error ? e.message : 'unknown error'
              }\n\nNothing was downloaded.`
            );
            console.error(e);
          }
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
