'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Failsafe: reveal regardless if nothing else has, so content is never stuck hidden. */
const FAILSAFE_MS = 1200;

/**
 * Reveals its children when they scroll into view.
 *
 * Content availability comes first — an animation must never be able to hide
 * text permanently. Three guarantees:
 *  1. Anything already at or above the fold on mount is shown immediately, so a
 *     deep link, anchor jump or restored scroll position cannot skip past an
 *     element and leave it invisible forever.
 *  2. A failsafe timer reveals everything shortly after mount regardless.
 *  3. With no IntersectionObserver, or with reduced motion, it renders visible.
 */
export function Reveal({
  children, delayMs = 0, className,
}: { children: ReactNode; delayMs?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    // Already in view, or scrolled past — show it now rather than waiting for an
    // intersection that will never happen.
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      setVisible(true);
      return;
    }

    const failsafe = window.setTimeout(() => setVisible(true), FAILSAFE_MS + delayMs);

    const observer = new IntersectionObserver(
      ([entry]) => {
        // `boundingClientRect.top < 0` catches an element the viewport jumped past.
        if (entry && (entry.isIntersecting || entry.boundingClientRect.top < 0)) {
          setVisible(true);
          observer.disconnect(); // reveal once; never re-hide
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -32px 0px' },
    );

    observer.observe(element);
    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
    };
  }, [delayMs]);

  return (
    <div
      ref={ref}
      data-visible={visible}
      style={delayMs && !visible ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={cn('reveal', className)}
    >
      {children}
    </div>
  );
}
