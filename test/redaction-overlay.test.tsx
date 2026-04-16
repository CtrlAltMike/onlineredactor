import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RedactionOverlay } from '@/components/redaction-overlay';

describe('RedactionOverlay', () => {
  it('calls onCommit with the drawn box in canvas coords', () => {
    const onCommit = vi.fn();
    render(
      <RedactionOverlay
        width={600}
        height={800}
        pageIndex={0}
        onCommit={onCommit}
      />
    );
    const overlay = screen.getByTestId('redaction-overlay-0');

    // Stub bounding client rect so coords are predictable.
    overlay.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 600, bottom: 800, width: 600, height: 800 } as DOMRect);

    fireEvent.mouseDown(overlay, { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(overlay, { clientX: 110, clientY: 70 });
    fireEvent.mouseUp(overlay, { clientX: 110, clientY: 70 });

    expect(onCommit).toHaveBeenCalledWith({
      page: 0,
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
  });
});
