'use client';

import { useRef, useState } from 'react';

type Box = { x: number; y: number; width: number; height: number };

type Props = {
  width: number;
  height: number;
  pageIndex: number;
  onCommit: (box: Box & { page: number }) => void;
  existing?: Array<Box>;
};

export function RedactionOverlay({
  width,
  height,
  pageIndex,
  onCommit,
  existing = [],
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  function pointerAt(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  return (
    <div
      ref={ref}
      data-testid={`redaction-overlay-${pageIndex}`}
      className="absolute inset-0 cursor-crosshair"
      style={{ width, height }}
      onMouseDown={(e) => {
        start.current = pointerAt(e);
        setDraft({ x: start.current.x, y: start.current.y, width: 0, height: 0 });
      }}
      onMouseMove={(e) => {
        if (!start.current) return;
        const p = pointerAt(e);
        setDraft({
          x: Math.min(start.current.x, p.x),
          y: Math.min(start.current.y, p.y),
          width: Math.abs(p.x - start.current.x),
          height: Math.abs(p.y - start.current.y),
        });
      }}
      onMouseUp={() => {
        if (draft && draft.width > 0 && draft.height > 0) {
          onCommit({ page: pageIndex, ...draft });
        }
        start.current = null;
        setDraft(null);
      }}
    >
      {existing.map((b, i) => (
        <div
          key={i}
          className="absolute bg-black/90"
          style={{ left: b.x, top: b.y, width: b.width, height: b.height }}
        />
      ))}
      {draft && draft.width > 0 && (
        <div
          className="absolute bg-black/60 outline outline-2 outline-red-500"
          style={{
            left: draft.x,
            top: draft.y,
            width: draft.width,
            height: draft.height,
          }}
        />
      )}
    </div>
  );
}
