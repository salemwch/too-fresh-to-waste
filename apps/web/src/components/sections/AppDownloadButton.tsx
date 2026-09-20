'use client';

import type { ReactNode } from 'react';
import { useAppLaunchModal } from '@/lib/app-launch-modal.store';
import { getStoreUrl, getPrimaryStoreUrl, type AppPlatform } from '@/lib/app-store-links';

interface AppDownloadButtonProps {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
  /**
   * Which store this button is for. Omit for a generic "Download the app" CTA,
   * which resolves to the primary (Android) store.
   *
   * Passing this matters once one platform is published and the other is not:
   * an `ios` button keeps opening the launch modal while `android` becomes a
   * real link, rather than both guessing.
   */
  platform?: AppPlatform;
  /**
   * Side effect to run when the CTA is activated, in *both* branches - closing
   * the mobile menu, for instance. Kept separate from the navigation so a call
   * site cannot accidentally replace the link behaviour with its own handler.
   */
  onActivate?: () => void;
  /** For CTAs inside a menu, which need `role='menuitem'` on the focusable. */
  role?: string;
}

/**
 * A download CTA that is a link once the app is published and a launch-modal
 * trigger until then.
 *
 * Call sites do not choose between the two - that is the whole point. See
 * `@/lib/app-store-links` for why the decision is centralised and how
 * publishing flips it.
 */
export function AppDownloadButton({
  children,
  className,
  'aria-label': ariaLabel,
  platform,
  onActivate,
  role,
}: AppDownloadButtonProps) {
  const { open } = useAppLaunchModal();
  const href = platform ? getStoreUrl(platform) : getPrimaryStoreUrl();

  if (href) {
    return (
      <a
        href={href}
        onClick={onActivate}
        {...(role ? { role } : {})}
        // The store is another origin, so this leaves the site. `noopener`
        // denies the opened page access to `window.opener`; `noreferrer`
        // follows it because `noopener` alone is ignored by older browsers.
        target='_blank'
        rel='noopener noreferrer'
        className={className}
        aria-label={ariaLabel}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type='button'
      onClick={() => {
        onActivate?.();
        open();
      }}
      className={className}
      aria-label={ariaLabel}
      {...(role ? { role } : {})}
    >
      {children}
    </button>
  );
}
