import { useState, useEffect } from 'react';

interface ScrollPosition {
  scrollY: number;
  isScrolled: boolean;
}

/**
 * Custom hook to track scroll position and determine if user has scrolled past threshold
 * OPTIMIZED: Initializes with current scroll position to prevent flicker on refresh
 * @param threshold - Pixel value to determine when isScrolled becomes true (default: 50)
 * @returns Object with scrollY position and isScrolled boolean
 */
export function useScrollPosition(threshold: number = 50): ScrollPosition {
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

    // Add scroll listener with passive flag for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return scrollPosition;
}
