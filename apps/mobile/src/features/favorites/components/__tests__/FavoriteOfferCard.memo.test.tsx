/**
 * FavoriteOfferCard — memo regression
 *
 * FavoriteOfferCard sits between every offer list and the memoized OfferCard.
 * As a plain function component it re-ran on each parent render, once per card,
 * re-executing useFavoriteToggle and a useSelector before the inner memo
 * decided nothing had changed.
 *
 * Note what these tests can and cannot show. The inner card is memoized and
 * `toggle` is useCallback'd, so with stable props the CARD does not repaint
 * either way — the render-count cases below pass with or without the outer
 * memo, and are here to pin that the memo does not break correctness. The case
 * that actually guards the fix is the first one: it asserts the wrapper is
 * memo-wrapped at all, which is the thing that stops the wrapper's own hook
 * work from running N times per parent render.
 */

import { render } from '@testing-library/react-native';
import React from 'react';

// Must be `mock`-prefixed: jest hoists the factory above this declaration and
// forbids it referencing any other out-of-scope binding.
const mockOfferCardRenders = jest.fn();

jest.mock('@/design-system/components/organisms', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  // Mirrors the real module: the exported OfferCard is memo-wrapped.
  const Inner = (props: { offer: { title: string } }) => {
    mockOfferCardRenders();
    return mockReact.createElement(mockRN.Text, null, props.offer.title);
  };
  return { OfferCard: mockReact.memo(Inner) };
});

const mockToggle = jest.fn();
jest.mock('../../hooks', () => ({
  useFavoriteToggle: () => ({ toggle: mockToggle, isFavorite: false, isLoading: false }),
}));

import { FavoriteOfferCard } from '../FavoriteOfferCard';

const offer = { id: 'o1', title: 'Surprise Bag', image: 'x' } as never;

describe('FavoriteOfferCard memoization', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is wrapped in React.memo', () => {
    // A memo component is an object with a $$typeof of react.memo, not a
    // function. Asserting this directly stops someone unwrapping it later.
    expect(typeof FavoriteOfferCard).toBe('object');
    expect(String((FavoriteOfferCard as unknown as { $$typeof: symbol }).$$typeof)).toContain(
      'memo',
    );
  });

  // Correctness guard rather than a proof of the optimisation: the inner memo
  // already covered this case. Here to catch a future change that makes props
  // unstable again.
  it('does not re-render the inner card when the parent re-renders with equal props', () => {
    const { rerender } = render(<FavoriteOfferCard offer={offer} testID='c' />);
    expect(mockOfferCardRenders).toHaveBeenCalledTimes(1);

    rerender(<FavoriteOfferCard offer={offer} testID='c' />);
    expect(mockOfferCardRenders).toHaveBeenCalledTimes(1);
  });

  it('still re-renders when the offer actually changes', () => {
    const { rerender } = render(<FavoriteOfferCard offer={offer} testID='c' />);
    expect(mockOfferCardRenders).toHaveBeenCalledTimes(1);

    rerender(
      <FavoriteOfferCard
        offer={{ id: 'o2', title: 'Another Bag', image: 'y' } as never}
        testID='c'
      />,
    );
    expect(mockOfferCardRenders).toHaveBeenCalledTimes(2);
  });
});
