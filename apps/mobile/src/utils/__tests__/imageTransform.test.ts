/**
 * Supabase image URL handling.
 *
 * Used by OfferCard, Avatar, UserAvatar, NeighborhoodSection,
 * FloatingPositionBar and DiscountClaimModal. A bug here silently breaks images
 * across the app.
 */

import {
  buildSupabaseRenderUrl,
  getOptimizedImageUrl,
  IMAGE_PRESETS,
  SUPABASE_IMAGE_TRANSFORMS_ENABLED,
} from '../imageTransform';

const SUPABASE_URL = 'https://abc.supabase.co/storage/v1/object/public/images/photo.jpg';
const SUPABASE_RENDER = 'https://abc.supabase.co/storage/v1/render/image/public/images/photo.jpg';

describe('getOptimizedImageUrl', () => {
  it('is switched off while the Supabase project has no Image Transformations', () => {
    // Free plan, confirmed 2026-10-05. If this flips, the cases below must be
    // rewritten to expect render URLs - that is the point of asserting it here.
    expect(SUPABASE_IMAGE_TRANSFORMS_ENABLED).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
  ])('returns undefined for %s', (_label, input) => {
    expect(getOptimizedImageUrl(input, IMAGE_PRESETS.avatar)).toBeUndefined();
  });

  it.each(Object.entries(IMAGE_PRESETS))(
    'serves the stored Supabase URL, never a render URL, for the %s preset',
    (_name, preset) => {
      const result = getOptimizedImageUrl(SUPABASE_URL, preset);
      expect(result).toBe(SUPABASE_URL);
      expect(result).not.toContain('/render/image/');
    },
  );

  it('returns a non-Supabase URL unchanged', () => {
    const cdn = 'https://cdn.example.com/img/photo.jpg';
    expect(getOptimizedImageUrl(cdn, IMAGE_PRESETS.thumbnail)).toBe(cdn);
  });

  // The `SUPABASE_IMAGE_TRANSFORMS_ENABLED === true` branch is unreachable in
  // this build: it is a module constant. That branch is a direct delegation to
  // buildSupabaseRenderUrl, which is covered on its own below.
});

describe('buildSupabaseRenderUrl', () => {
  // -- absent input ----------------------------------------------------------

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
  ])('returns undefined for %s', (_label, input) => {
    expect(buildSupabaseRenderUrl(input, IMAGE_PRESETS.avatar)).toBeUndefined();
  });

  // -- non-Supabase URLs pass through untouched ------------------------------

  it('returns a non-Supabase URL unchanged', () => {
    const cdn = 'https://cdn.example.com/img/photo.jpg';
    expect(buildSupabaseRenderUrl(cdn, IMAGE_PRESETS.thumbnail)).toBe(cdn);
  });

  it('returns a relative path unchanged', () => {
    const path = '/static/logo.png';
    expect(buildSupabaseRenderUrl(path, IMAGE_PRESETS.thumbnail)).toBe(path);
  });

  // -- Supabase URL rewriting ------------------------------------------------

  it('rewrites the public path to the render path', () => {
    const result = buildSupabaseRenderUrl(SUPABASE_URL, { width: 100 });
    expect(result).toContain('/storage/v1/render/image/public/');
    expect(result).not.toContain('/storage/v1/object/public/');
  });

  it('appends width and height as query params', () => {
    const result = buildSupabaseRenderUrl(SUPABASE_URL, { width: 200, height: 150 });
    expect(result).toBe(`${SUPABASE_RENDER}?width=200&height=150`);
  });

  it('appends quality param', () => {
    const result = buildSupabaseRenderUrl(SUPABASE_URL, { quality: 75 });
    expect(result).toBe(`${SUPABASE_RENDER}?quality=75`);
  });

  it('appends format param', () => {
    const result = buildSupabaseRenderUrl(SUPABASE_URL, { format: 'webp' });
    expect(result).toBe(`${SUPABASE_RENDER}?format=webp`);
  });

  it('appends resize param', () => {
    const result = buildSupabaseRenderUrl(SUPABASE_URL, { resize: 'cover' });
    expect(result).toBe(`${SUPABASE_RENDER}?resize=cover`);
  });

  it('combines all options into one query string', () => {
    const result = buildSupabaseRenderUrl(SUPABASE_URL, IMAGE_PRESETS.avatar);
    const url = new URL(result!);
    expect(url.searchParams.get('width')).toBe('100');
    expect(url.searchParams.get('height')).toBe('100');
    expect(url.searchParams.get('quality')).toBe('80');
    expect(url.searchParams.get('format')).toBe('webp');
  });

  it('omits zero-valued options instead of sending width=0', () => {
    const result = buildSupabaseRenderUrl(SUPABASE_URL, { width: 0, quality: 0 });
    expect(result).toBe(SUPABASE_RENDER);
  });

  it('returns the render path without query string when no options have values', () => {
    const result = buildSupabaseRenderUrl(SUPABASE_URL, {});
    expect(result).toBe(SUPABASE_RENDER);
  });
});

describe('IMAGE_PRESETS', () => {
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
