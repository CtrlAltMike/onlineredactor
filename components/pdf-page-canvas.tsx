'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { renderPageToCanvas } from '@/lib/pdf/render';
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
    let cancelled = false;
    if (ref.current) {
      renderPageToCanvas(page, ref.current)
        .then((d) => {
          if (!cancelled) setDims({ w: d.viewportWidth, h: d.viewportHeight });
        })
        .catch((err) => {
          if (!cancelled) console.error('render failed', err);
        });
    }
    return () => {
      cancelled = true;
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
