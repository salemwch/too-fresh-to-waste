import type { KeyboardEvent } from 'react';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Keyboard half of a clickable non-button element.
 *
 * A `<div onClick>` is invisible to anyone not using a mouse: it takes no focus
 * and fires on no key. Where the layout genuinely rules out a real `<button>`
 * — grid rows whose cells must stay direct children of the grid — pair this
 * with `role='button'` and `tabIndex={0}` so the element behaves like the
 * button it is pretending to be.
 *
 * Enter and Space are what a native button responds to. Space is also what
 * scrolls the page, so it is prevented here; without that the row activates
 * and the page jumps at the same time.
 *
 *   <div role='button' tabIndex={0} onClick={open} onKeyDown={activateOnKey(open)} />
 */
export function activateOnKey(activate: () => void) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  };
}
