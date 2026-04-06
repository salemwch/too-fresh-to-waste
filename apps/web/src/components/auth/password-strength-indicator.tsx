'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@foodwaste/ui';

interface PasswordStrengthIndicatorProps {
  password: string;
}

function getStrengthScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 5);
}

const strengthColors = [
  'bg-destructive',
  'bg-destructive',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-green-500',
  'bg-green-600',
];

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const t = useTranslations('auth');
  const score = useMemo(() => getStrengthScore(password), [password]);

  if (!password) return null;

  const strengthKeys = ['veryWeak', 'weak', 'fair', 'good', 'strong', 'veryStrong'] as const;
  const strengthKey = strengthKeys[score] ?? 'veryWeak';

  return (
    <div className='space-y-1'>
      <div className='flex gap-1'>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i < score ? strengthColors[score] : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p className='text-xs text-muted-foreground'>{t(`passwordStrength.${strengthKey}`)}</p>
    </div>
  );
}
