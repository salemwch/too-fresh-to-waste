/**
 * Resolve a media URL stored by the backend to a browser-accessible URL.
 *
 * Problem: when images are uploaded from the Android emulator, the backend
 * stores the full URL including the emulator's special localhost alias
 * (10.0.2.2). Web browsers cannot reach that address.
 *
 * This helper replaces the stored host with the actual API base URL so images
 * always load regardless of which client originally uploaded them.
 */

const API_BASE =
  (process.env['NEXT_PUBLIC_API_URL'] as string | undefined) ?? 'http://localhost:3000';

// Pre-parse once so we don't re-parse on every call
let _apiHost = 'localhost';
let _apiPort = '3000';
let _apiProtocol = 'http:';
try {
  const parsed = new URL(API_BASE);
  _apiHost     = parsed.hostname;
  _apiPort     = parsed.port;
  _apiProtocol = parsed.protocol;
} catch {
  // ignore — defaults above are fine for local dev
}

/** Hostnames that only work from within the Android emulator. */
const EMULATOR_HOSTS = new Set(['10.0.2.2', '10.0.3.2']);

export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);

    // Rewrite emulator-only hostnames to the real API host
    if (EMULATOR_HOSTS.has(parsed.hostname)) {
      parsed.protocol = _apiProtocol;
      parsed.hostname  = _apiHost;
      parsed.port      = _apiPort;
      return parsed.toString();
    }

    return url;
  } catch {
    // Relative path — prepend the API base
    if (url.startsWith('/')) {
      return `${API_BASE}${url}`;
    }
    return url;
  }
}

/**
 * Resolve the best available profile image for a user.
 * Priority: profileImage → avatar → undefined
 */
export function resolveProfileImage(
  profileImage?: string | null,
  avatar?: string | null,
): string | undefined {
  return resolveMediaUrl(profileImage ?? avatar);
}
