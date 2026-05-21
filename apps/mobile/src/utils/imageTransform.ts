export interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'origin';
  resize?: 'cover' | 'contain' | 'fill';
}

const SUPABASE_PUBLIC_PATH = '/storage/v1/object/public/';
const SUPABASE_RENDER_PATH = '/storage/v1/render/image/public/';

export function getOptimizedImageUrl(
  url: string | null | undefined,
  options: ImageTransformOptions,
): string | undefined {
  if (!url) return undefined;
  if (!url.includes(SUPABASE_PUBLIC_PATH)) return url;

  const transformed = url.replace(SUPABASE_PUBLIC_PATH, SUPABASE_RENDER_PATH);
  const params = new URLSearchParams();
  if (options.width) params.set('width', String(options.width));
  if (options.height) params.set('height', String(options.height));
  if (options.quality) params.set('quality', String(options.quality ?? 80));
  if (options.format) params.set('format', options.format);
  if (options.resize) params.set('resize', options.resize);

  const qs = params.toString();
  return qs ? `${transformed}?${qs}` : transformed;
}

export const IMAGE_PRESETS = {
  thumbnail: { width: 150, height: 150, quality: 75, format: 'webp' as const },
  listCard: { width: 400, height: 300, quality: 80, format: 'webp' as const },
  avatar: { width: 100, height: 100, quality: 80, format: 'webp' as const },
  avatarLarge: { width: 200, height: 200, quality: 85, format: 'webp' as const },
  fullWidth: { width: 800, height: 600, quality: 85, format: 'webp' as const },
} as const;
