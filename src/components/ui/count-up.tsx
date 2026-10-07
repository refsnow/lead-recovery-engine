'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts a number up on mount. Purely decorative — the final value is rendered
 * immediately for anyone who prefers reduced motion, and the element carries
 * the true value in `aria-label` so assistive tech never reads a partial count.
 */
export function CountUp({
  value, durationMs = 900, className,
}: { value: number; durationMs?: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || value === 0) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    setDisplay(0);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — fast start, gentle settle.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, durationMs]);

  return (
    <span className={className} aria-label={String(value)}>
      <span aria-hidden>{display.toLocaleString('en-IN')}</span>
    </span>
  );
}
