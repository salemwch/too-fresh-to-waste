'use client';

import { useEffect, useRef } from 'react';

/**
 * Marks an element `data-revealed="true"` the first time it enters the
 * viewport, so descendants carrying `.sr-*` can transition in. One observer
 * per section, disconnected on first hit - the reveal never replays.
 *
 * Reduced motion is handled in CSS, not here. Under `prefers-reduced-motion`
 * the `.sr-*` transforms are dropped and only the opacity fade remains, so the
 * observer must still run. Short-circuiting it here is what made the reveal
 * look broken on a machine with the OS setting on: elements were painted at
 * their final state before they were ever scrolled to.
 */
export function useScrollReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver (or SSR-hydration edge): show everything rather
    // than leaving the section permanently blank.
    if (typeof IntersectionObserver === 'undefined') {
      el.dataset.revealed = 'true';
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          el.dataset.revealed = 'true';
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}
