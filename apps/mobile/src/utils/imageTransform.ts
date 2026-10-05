export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'origin';
  resize?: 'cover' | 'contain' | 'fill';
}

const SUPABASE_PUBLIC_PATH = '/storage/v1/object/public/';
const SUPABASE_RENDER_PATH = '/storage/v1/render/image/public/';

/**
 * Supabase Image Transformations are a paid-plan feature, and the project is on
 * the Free plan (confirmed 2026-10-05). On Free every `/render/image/` request
 * fails, which cost twice: OfferCard made the failing request and then
 * re-downloaded the original, and Avatar fell back to initials with no retry,
 * so profile photos never showed.
 *
 * Nothing is lost by serving the stored file: the backend already resizes on
 * upload (offers 800x600, profile images 400x400) and Glide downsamples to the
 * view size before decoding.
 *
 * Flip to `true` only after Image Transformations is enabled on the project.
 */
export const SUPABASE_IMAGE_TRANSFORMS_ENABLED = false;

/**
 * Rewrites a Supabase public object URL to its on-the-fly transform URL.
 * Pure: it does not consult `SUPABASE_IMAGE_TRANSFORMS_ENABLED`.
 */
export function buildSupabaseRenderUrl(
  url: string | null | undefined,
  options: ImageTransformOptions,
): string | undefined {
  if (!url) return undefined;
  if (!url.includes(SUPABASE_PUBLIC_PATH)) return url;

  const transformed = url.replace(SUPABASE_PUBLIC_PATH, SUPABASE_RENDER_PATH);
  const params = new URLSearchParams();
  if (options.width) params.set('width', String(options.width));
  if (options.height) params.set('height', String(options.height));
  if (options.quality) params.set('quality', String(options.quality));
  if (options.format) params.set('format', options.format);
  if (options.resize) params.set('resize', options.resize);

  const qs = params.toString();
  return qs ? `${transformed}?${qs}` : transformed;
}

/**
 * The URL to load for an image. Returns the stored URL unchanged while
 * transforms are unavailable; see `SUPABASE_IMAGE_TRANSFORMS_ENABLED`.
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  options: ImageTransformOptions,
): string | undefined {
  if (!url) return undefined;
  if (!SUPABASE_IMAGE_TRANSFORMS_ENABLED) return url;
  return buildSupabaseRenderUrl(url, options);
}

export const IMAGE_PRESETS = {
  thumbnail: { width: 150, height: 150, quality: 75, format: 'webp' as const },
  listCard: { width: 400, height: 300, quality: 80, format: 'webp' as const },
  avatar: { width: 100, height: 100, quality: 80, format: 'webp' as const },
  avatarLarge: { width: 200, height: 200, quality: 85, format: 'webp' as const },
  fullWidth: { width: 800, height: 600, quality: 85, format: 'webp' as const },
} as const;
