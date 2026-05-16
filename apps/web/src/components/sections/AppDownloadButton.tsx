'use client';

import type { ReactNode } from 'react';
import { useAppLaunchModal } from '@/lib/app-launch-modal.store';

interface AppDownloadButtonProps {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

export function AppDownloadButton({
  children,
  className,
  'aria-label': ariaLabel,
}: AppDownloadButtonProps) {
  const { open } = useAppLaunchModal();
  return (
    <button type='button' onClick={open} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
