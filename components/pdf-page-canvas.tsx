'use client';

import { useEffect, useRef } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { renderPageToCanvas } from '@/lib/pdf/render';

type Props = {
  page: PDFPageProxy;
  pageIndex: number;
};

export function PdfPageCanvas({ page, pageIndex }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (ref.current) {
      renderPageToCanvas(page, ref.current).catch((err) => {
        if (!cancelled) console.error('render failed', err);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <canvas
      ref={ref}
      aria-label={`Page ${pageIndex + 1}`}
      className="block border border-neutral-200"
    />
  );
}
