'use client';

import { useEffect } from 'react';

/**
 * HashScrollHandler
 *
 * Client component that handles scrolling to hash fragments in the URL.
 * This is necessary for cross-page navigation (e.g., /merchant-signup -> /#features)
 * because Next.js client-side routing may load the page before content is fully rendered.
 */
export function HashScrollHandler() {
  useEffect(() => {
    // Check if there's a hash in the URL
    const hash = window.location.hash;

    if (hash) {
      // Remove the # symbol
      const id = hash.substring(1);

      // Wait for the page to fully render before scrolling
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        setTimeout(() => {
          const element = document.getElementById(id);

          if (element) {
            // Scroll to the element with smooth behavior
            element.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }
        }, 100); // Small delay to ensure all components are mounted
      });
    }
  }, []); // Run only on mount

  return null; // This component doesn't render anything
}
