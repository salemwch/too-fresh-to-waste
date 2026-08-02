/**
 * getOptimizedImageUrl — Supabase image URL rewriting.
 *
 * Used by OrderCard, UserAvatar, NeighborhoodSection, OfferCard, and
 * DiscountClaimModal. A bug here silently breaks images across the app.
 */

import { getOptimizedImageUrl, IMAGE_PRESETS } from '../imageTransform';

const SUPABASE_URL = 'https://abc.supabase.co/storage/v1/object/public/images/photo.jpg';
const SUPABASE_RENDER = 'https://abc.supabase.co/storage/v1/render/image/public/images/photo.jpg';

describe('getOptimizedImageUrl', () => {
  // -- absent input ----------------------------------------------------------

  it('returns undefined for null', () => {
    expect(getOptimizedImageUrl(null, IMAGE_PRESETS.avatar)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(getOptimizedImageUrl(undefined, IMAGE_PRESETS.avatar)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getOptimizedImageUrl('', IMAGE_PRESETS.avatar)).toBeUndefined();
  });

  // -- non-Supabase URLs pass through untouched ------------------------------

  it('returns a non-Supabase URL unchanged', () => {
    const cdn = 'https://cdn.example.com/img/photo.jpg';
    expect(getOptimizedImageUrl(cdn, IMAGE_PRESETS.thumbnail)).toBe(cdn);
  });

  it('returns a relative path unchanged', () => {
    const path = '/static/logo.png';
    expect(getOptimizedImageUrl(path, IMAGE_PRESETS.thumbnail)).toBe(path);
  });

  // -- Supabase URL rewriting ------------------------------------------------

  it('rewrites the public path to the render path', () => {
    const result = getOptimizedImageUrl(SUPABASE_URL, { width: 100 });
    expect(result).toContain('/storage/v1/render/image/public/');
    expect(result).not.toContain('/storage/v1/object/public/');
  });

  it('appends width and height as query params', () => {
    const result = getOptimizedImageUrl(SUPABASE_URL, { width: 200, height: 150 });
    expect(result).toBe(`${SUPABASE_RENDER}?width=200&height=150`);
  });

  it('appends quality param', () => {
    const result = getOptimizedImageUrl(SUPABASE_URL, { quality: 75 });
    expect(result).toBe(`${SUPABASE_RENDER}?quality=75`);
  });

  it('appends format param', () => {
    const result = getOptimizedImageUrl(SUPABASE_URL, { format: 'webp' });
    expect(result).toBe(`${SUPABASE_RENDER}?format=webp`);
  });

  it('appends resize param', () => {
    const result = getOptimizedImageUrl(SUPABASE_URL, { resize: 'cover' });
    expect(result).toBe(`${SUPABASE_RENDER}?resize=cover`);
  });

  it('combines all options into one query string', () => {
    const result = getOptimizedImageUrl(SUPABASE_URL, IMAGE_PRESETS.avatar);
    const url = new URL(result!);
    expect(url.searchParams.get('width')).toBe('100');
    expect(url.searchParams.get('height')).toBe('100');
    expect(url.searchParams.get('quality')).toBe('80');
    expect(url.searchParams.get('format')).toBe('webp');
  });

  it('returns the render path without query string when no options have values', () => {
    const result = getOptimizedImageUrl(SUPABASE_URL, {});
    expect(result).toBe(SUPABASE_RENDER);
  });

  // -- presets ---------------------------------------------------------------

  it('thumbnail preset produces expected dimensions', () => {
    expect(IMAGE_PRESETS.thumbnail).toEqual({
      width: 150,
      height: 150,
      quality: 75,
      format: 'webp',
    });
  });

  it('fullWidth preset uses higher quality', () => {
    expect(IMAGE_PRESETS.fullWidth.quality).toBe(85);
    expect(IMAGE_PRESETS.fullWidth.width).toBe(800);
  });
});
