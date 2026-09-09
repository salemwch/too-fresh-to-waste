import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface ScrollPosition {
  scrollY: number;
  isScrolled: boolean;
}

/**
 * Custom hook to track scroll position and determine if user has scrolled past threshold
 * BEST PRACTICE (2025): Route-aware scroll tracking that resets on navigation
 * Based on patterns from Stripe, Airbnb, and modern web design standards
 *
 * @param threshold - Pixel value to determine when isScrolled becomes true (default: 50)
 * @returns Object with scrollY position and isScrolled boolean
 */
export function useScrollPosition(threshold: number = 50): ScrollPosition {
  const pathname = usePathname();

  // Initialize with actual scroll position (SSR-safe)
  const [scrollPosition, setScrollPosition] = useState<ScrollPosition>(() => {
    // Server-side: default to top
    if (typeof window === 'undefined') {
      return { scrollY: 0, isScrolled: false };
    }
    // Client-side: use actual scroll position immediately
    const currentScrollY = window.scrollY;
    return {
      scrollY: currentScrollY,
      isScrolled: currentScrollY > threshold,
    };
  });

  /*
   * Reset scroll state when the route changes, so a header does not stay in its
   * scrolled colour on a freshly navigated page.
   *
   * Adjusted during render rather than in an effect. This is React's documented
   * "adjusting state when a prop changes" pattern: React discards the render
   * and re-runs the component immediately, before committing or painting, so
   * the reset value is what lands on screen. The previous effect version
   * committed the stale position first and corrected it on a second pass -
   * a cascading render, which is exactly what react-hooks flags here.
   * https://react.dev/learn/you-might-not-need-an-effect
   */
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setScrollPosition({ scrollY: 0, isScrolled: false });
  }

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollPosition({
        scrollY: currentScrollY,
        isScrolled: currentScrollY > threshold,
      });
    };

    // Initialize with current scroll position
    handleScroll();

    // Add scroll listener with passive flag for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return scrollPosition;
}
