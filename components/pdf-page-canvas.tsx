'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { startRenderPage } from '@/lib/pdf/render';
import { RedactionOverlay } from '@/components/redaction-overlay';

type Box = { x: number; y: number; width: number; height: number };

type Props = {
  page: PDFPageProxy;
  pageIndex: number;
  existing?: Box[];
  onCommit?: (box: Box & { page: number }) => void;
};

export function PdfPageCanvas({
  page,
  pageIndex,
  existing = [],
  onCommit,
}: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    const handle = startRenderPage(page, ref.current);
    handle.done
      .then((d) => {
        if (!cancelled) setDims({ w: d.viewportWidth, h: d.viewportHeight });
      })
      .catch((err) => {
        // pdfjs throws a RenderingCancelledException when we cancel — that's
        // expected (dev StrictMode / fast page swap) and not a real failure.
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          console.error('render failed', err);
        }
      });
    return () => {
      cancelled = true;
      handle.cancel();
    };
  }, [page]);

  return (
    <div className="relative inline-block">
      <canvas
        ref={ref}
        aria-label={`Page ${pageIndex + 1}`}
        className="block border border-neutral-200"
      />
      {dims && onCommit && (
        <RedactionOverlay
          width={dims.w}
          height={dims.h}
          pageIndex={pageIndex}
          existing={existing}
          onCommit={onCommit}
        />
      )}
    </div>
  );
}
