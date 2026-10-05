/**
 * OfferCard - image error fallback
 *
 * The card loads the optimized URL first and falls back to the raw URL on
 * error. With Supabase transforms off (`SUPABASE_IMAGE_TRANSFORMS_ENABLED`),
 * the optimized URL IS the raw URL, so "falling back" re-requested the same
 * broken image and kept the shimmer up for a second failure. A failure with
 * nothing different to try must end the loading state at once.
 */

import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Image } from 'react-native';

import { ThemeProvider } from '../../../../providers';
import { ShimmerBlock } from '../../../atoms/ShimmerBlock/ShimmerBlock';
import { OfferCard } from '../OfferCard';

const SUPABASE_IMAGE = 'https://abc.supabase.co/storage/v1/object/public/uploads/offers/bag.jpg';

// Fixture shape follows FavoriteOfferCard.memo.test.tsx: only the fields the
// card reads on this path.
const offerWith = (image: string | undefined) =>
  ({
    id: 'o1',
    title: 'Surprise Bag',
    image,
    pricing: { originalPrice: 30, discountedPrice: 10, discountPercentage: 67, currency: 'TND' },
    availableQuantity: 3,
    availableUntil: '2099-01-01T18:00:00.000Z',
    status: 'active',
  }) as never;

const renderCard = (image: string | undefined) =>
  render(
    <ThemeProvider>
      <OfferCard offer={offerWith(image)} showEstablishment={false} />
    </ThemeProvider>,
  );

const offerImage = (view: ReturnType<typeof renderCard>, uri: string) => {
  const match = view
    .UNSAFE_getAllByType(Image)
    .find(el => (el.props['source'] as { uri?: string } | undefined)?.uri === uri);
  if (!match) throw new Error(`no image rendered with uri ${uri}`);
  return match;
};

describe('OfferCard image error fallback', () => {
  it('requests the stored URL directly while transforms are off', () => {
    const view = renderCard(SUPABASE_IMAGE);
    expect(offerImage(view, SUPABASE_IMAGE)).toBeTruthy();
  });

  it('shows the shimmer until the image settles', () => {
    const view = renderCard(SUPABASE_IMAGE);
    expect(view.UNSAFE_queryAllByType(ShimmerBlock).length).toBeGreaterThan(0);
  });

  it('ends the loading state on the first failure when there is no other URL to try', () => {
    const view = renderCard(SUPABASE_IMAGE);
    const image = offerImage(view, SUPABASE_IMAGE);
    const sourceBefore = image.props['source'];

    fireEvent(image, 'error');

    expect(view.UNSAFE_queryAllByType(ShimmerBlock)).toHaveLength(0);
    // No retry: the source was not swapped for an identical one.
    expect(offerImage(view, SUPABASE_IMAGE).props['source']).toBe(sourceBefore);
  });

  it('ends the loading state when the image loads', () => {
    const view = renderCard(SUPABASE_IMAGE);
    fireEvent(offerImage(view, SUPABASE_IMAGE), 'load');
    expect(view.UNSAFE_queryAllByType(ShimmerBlock)).toHaveLength(0);
  });
});
