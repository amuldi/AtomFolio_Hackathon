import { useState, useEffect } from 'react';
import { alignedDockXFor, swirlDockSizeFor, swirlDockYFor } from '../../utils/layout.js';
import { SketchSpiralIcon } from '../icons/index.jsx';

export function FloatingSpiralGlyph({ anchorRef }) {
  const anchoredPosition = () => {
    if (typeof window === 'undefined') {
      return { x: 0, y: 0 };
    }

    const width = window.innerWidth;

    return {
      x: alignedDockXFor(
        width,
        swirlDockSizeFor(width),
        anchorRef?.current?.getBoundingClientRect().width ?? 0,
      ),
      y: swirlDockYFor(width),
    };
  };
  const [position, setPosition] = useState(anchoredPosition);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncPosition = () => {
      setPosition(anchoredPosition());
    };

    const frameId = window.requestAnimationFrame(syncPosition);
    window.addEventListener('resize', syncPosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', syncPosition);
    };
  }, [anchorRef]);

  return (
    <div
      className="spiral-glyph"
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
      aria-hidden="true"
    >
      <SketchSpiralIcon />
    </div>
  );
}
