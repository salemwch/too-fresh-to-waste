'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Award,
  Star,
  ShoppingBag,
  Gift,
  Copy,
  Share2,
  Flame,
  Target,
  AlertCircle,
  Heart,
  Lock,
  Check,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  useLoyaltyAccount,
  useLoyaltyStats,
  useGamification,
  useReferralCode,
  useDonationHistory,
  useDonatePoints,
} from '@/hooks/use-loyalty';
import { TIER_CONFIG, type LoyaltyTier, type DonationHistoryItem } from '@/types/loyalty';

// ─── Skeletons ──────────────────────────────────────────────────────────────

function LoyaltySkeleton() {
  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className='glass rounded-2xl p-[24px] shadow-soft'>
            <Skeleton className='h-4 w-20 mb-3' />
            <Skeleton className='h-8 w-16' />
          </div>
        ))}
      </div>
      <div className='glass rounded-2xl p-[24px] shadow-soft'>
        <Skeleton className='h-6 w-48 mb-4' />
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-8 w-full mt-3' />
      </div>
    </div>
  );
}

// ─── Error state ────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className='glass rounded-2xl p-[24px] shadow-soft'>
      <div className='flex flex-col items-center justify-center py-10 gap-3 text-center'>
        <AlertCircle className='size-12 text-muted-foreground' />
        <p className='text-sm text-muted-foreground'>{message}</p>
        {onRetry && (
          <Button variant='outline' size='sm' onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Tier Progress ──────────────────────────────────────────────────────────

const TIER_ORDER: LoyaltyTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum'];

function TierProgress({
  currentTier,
  totalPoints,
}: {
  currentTier: LoyaltyTier;
  totalPoints: number;
}) {
  const t = useTranslations('dashboard.loyalty');
  const currentIdx = TIER_ORDER.indexOf(currentTier);
  const nextTier = currentIdx < TIER_ORDER.length - 1 ? TIER_ORDER[currentIdx + 1] : null;
  const nextThreshold = nextTier
    ? TIER_CONFIG[nextTier].threshold
    : TIER_CONFIG[currentTier].threshold;
  const currentThreshold = TIER_CONFIG[currentTier].threshold;
  const progress = nextTier
    ? Math.min(100, ((totalPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100)
    : 100;

  return (
    <div className='glass rounded-2xl p-[24px] shadow-soft'>
      <div className='flex items-center justify-between mb-4'>
        <div>
          <h3 className='font-semibold text-sm'>{t('stats.currentTier')}</h3>
          <div className='flex items-center gap-2 mt-1'>
            <div
              className='size-6 rounded-full flex items-center justify-center'
              style={{ backgroundColor: TIER_CONFIG[currentTier].color + '30' }}
            >
              <Award className='size-4' style={{ color: TIER_CONFIG[currentTier].color }} />
            </div>
            <span
              className='font-display text-xl font-bold'
              style={{ color: TIER_CONFIG[currentTier].color }}
            >
              {t(`tiers.${currentTier.toLowerCase() as 'bronze' | 'silver' | 'gold' | 'platinum'}`)}
            </span>
          </div>
        </div>
        {nextTier && (
          <div className='text-end'>
            <p className='text-xs text-muted-foreground'>{t('stats.nextTier')}</p>
            <p className='text-sm font-semibold' style={{ color: TIER_CONFIG[nextTier].color }}>
              {t(`tiers.${nextTier.toLowerCase() as 'bronze' | 'silver' | 'gold' | 'platinum'}`)}
            </p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className='w-full h-3 rounded-full bg-muted overflow-hidden'>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className='h-full rounded-full'
          style={{ backgroundColor: TIER_CONFIG[currentTier].color }}
        />
      </div>
      <p className='text-xs text-muted-foreground mt-2'>
        {nextTier
          ? t('tiers.progress', {
              current: totalPoints.toString(),
              target: nextThreshold.toString(),
              tier: t(
                `tiers.${nextTier.toLowerCase() as 'bronze' | 'silver' | 'gold' | 'platinum'}`,
              ),
            })
          : t('tiers.reached')}
      </p>

      {/* Tier milestones */}
      <div className='flex justify-between mt-4'>
        {TIER_ORDER.map((tier, i) => {
          const isReached = i <= currentIdx;
          return (
            <div key={tier} className='flex flex-col items-center gap-1'>
              <div
                className={`size-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isReached ? 'border-transparent' : 'border-muted bg-muted/50'
                }`}
                style={
                  isReached
                    ? {
                        backgroundColor: TIER_CONFIG[tier].color + '20',
                        borderColor: TIER_CONFIG[tier].color,
                      }
                    : {}
                }
              >
                {isReached ? (
                  <Check className='size-4' style={{ color: TIER_CONFIG[tier].color }} />
                ) : (
                  <Lock className='size-3 text-muted-foreground' />
                )}
              </div>
              <span className={`text-xs ${isReached ? 'font-medium' : 'text-muted-foreground'}`}>
                {t(`tiers.${tier.toLowerCase() as 'bronze' | 'silver' | 'gold' | 'platinum'}`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Badges Section ─────────────────────────────────────────────────────────

function BadgesSection() {
  const t = useTranslations('dashboard.loyalty.badges');
  const { data: account } = useLoyaltyAccount();
  const badges = account?.badges || [];

  if (badges.length === 0) return null;

  return (
    <div className='glass rounded-2xl p-[24px] shadow-soft'>
      <h3 className='font-display text-lg text-primary-500 font-semibold mb-1'>{t('title')}</h3>
      <p className='text-xs text-muted-foreground mb-4'>{t('subtitle')}</p>
      <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3'>
        {badges.map(badge => (
          <motion.div
            key={badge.type}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className='flex flex-col items-center gap-1.5 p-3 rounded-xl bg-primary-500/[0.04] hover:bg-primary-500/[0.08] transition-colors'
          >
            <div className='size-10 rounded-full bg-amber-500/10 flex items-center justify-center'>
              <Star className='size-5 text-amber-500' />
            </div>
            <span className='text-xs font-medium text-center truncate w-full'>{badge.name}</span>
            <span className='text-[10px] text-muted-foreground'>
              {new Date(badge.earnedAt).toLocaleDateString()}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Referral Section ───────────────────────────────────────────────────────

function ReferralSection() {
  const t = useTranslations('dashboard.loyalty.referral');
  const { data: code } = useReferralCode();

  function handleCopy() {
    if (!code) return;
    void navigator.clipboard.writeText(code);
    toast.success(t('copied'));
  }

  return (
    <div className='glass rounded-2xl p-[24px] shadow-soft'>
      <h3 className='font-display text-lg text-primary-500 font-semibold mb-1'>{t('title')}</h3>
      <p className='text-xs text-muted-foreground mb-4'>{t('subtitle')}</p>

      <div className='flex items-center gap-2'>
        <div className='flex-1 rounded-xl border border-border bg-muted/30 px-4 py-2.5'>
          <p className='text-xs text-muted-foreground'>{t('code')}</p>
          <p className='font-mono text-sm font-semibold tracking-wider mt-0.5'>{code || '---'}</p>
        </div>
        <Button
          variant='outline'
          size='icon'
          onClick={handleCopy}
          disabled={!code}
          className='shrink-0 size-10'
        >
          <Copy className='size-4' />
        </Button>
        <Button
          variant='outline'
          size='icon'
          onClick={() => {
            if (!code) return;
            void navigator.share?.({ text: code }).catch(() => {});
          }}
          disabled={!code}
          className='shrink-0 size-10'
        >
          <Share2 className='size-4' />
        </Button>
      </div>
    </div>
  );
}

// ─── Gamification Section ───────────────────────────────────────────────────

function GamificationSection() {
  const t = useTranslations('dashboard.loyalty.gamification');
  const { data: gamification, isLoading } = useGamification();

  if (isLoading) {
    return (
      <div className='glass rounded-2xl p-[24px] shadow-soft'>
        <Skeleton className='h-6 w-32 mb-4' />
        <div className='grid grid-cols-2 gap-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-20 w-full rounded-xl' />
          ))}
        </div>
      </div>
    );
  }

  if (!gamification) return null;

  const progressCards = [
    {
      label: t('streak'),
      value: t('streakDays', { count: gamification.loginStreak.current }),
      sub: `Best: ${gamification.loginStreak.longest}`,
      icon: Flame,
      color: 'text-orange-500',
    },
    {
      label: t('weeklyGoal'),
      value: `${gamification.purchaseStreak.current}`,
      sub: `Best: ${gamification.purchaseStreak.longest}`,
      icon: Target,
      color: 'text-blue-500',
    },
    {
      label: 'Referrals',
      value: gamification.friendReferrals.count,
      sub: `+${gamification.friendReferrals.pointsEarned} pts`,
      icon: Users,
      color: 'text-violet-500',
    },
    {
      label: 'Reviews',
      value: gamification.reviewTracking.count,
      sub: `+${gamification.reviewTracking.pointsEarned} pts`,
      icon: Zap,
      color: 'text-amber-500',
    },
  ];

  return (
    <div className='glass rounded-2xl p-[24px] shadow-soft'>
      <h3 className='font-display text-lg text-primary-500 font-semibold mb-1'>{t('title')}</h3>
      <p className='text-xs text-muted-foreground mb-4'>{t('subtitle')}</p>

      <div className='grid grid-cols-2 gap-3'>
        {progressCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className='rounded-xl border border-border p-3'
            >
              <div className='flex items-center gap-2 mb-2'>
                <Icon className={`size-4 ${card.color}`} />
                <span className='text-xs text-muted-foreground'>{card.label}</span>
              </div>
              <p className='font-display text-xl font-bold text-primary-500'>{card.value}</p>
              <p className='text-xs text-muted-foreground mt-0.5'>{card.sub}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Donation Section ───────────────────────────────────────────────────────

function DonationSection() {
  const t = useTranslations('dashboard.loyalty.donations');
  const { data: donations, isLoading } = useDonationHistory();
  const donatePoints = useDonatePoints();
  const [donateDialogOpen, setDonateDialogOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [message, setMessage] = useState('');

  function handleDonate(e: FormEvent) {
    e.preventDefault();
    donatePoints.mutate(
      {
        amount: Number(amount),
        ...(isAnonymous ? { isAnonymous } : {}),
        ...(message ? { message } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t('success'));
          setDonateDialogOpen(false);
          setAmount('');
          setMessage('');
          setIsAnonymous(false);
        },
        onError: () => toast.error(t('error')),
      },
    );
  }

  return (
    <div className='glass rounded-2xl p-[24px] shadow-soft'>
      <div className='flex items-center justify-between mb-4'>
        <div>
          <h3 className='font-display text-lg text-primary-500 font-semibold'>{t('title')}</h3>
          <p className='text-xs text-muted-foreground'>{t('subtitle')}</p>
        </div>
        <Dialog open={donateDialogOpen} onOpenChange={setDonateDialogOpen}>
          <DialogTrigger asChild>
            <Button size='sm' className='bg-primary-500 hover:bg-primary-500/90 text-white'>
              <Heart className='size-4 me-2' />
              {t('donate')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('donate')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleDonate} className='space-y-4'>
              <div className='space-y-2'>
                <Label>{t('amount')}</Label>
                <Input
                  type='number'
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                  min={1}
                />
              </div>
              <div className='flex items-center gap-2'>
                <input
                  type='checkbox'
                  id='anonymous'
                  checked={isAnonymous}
                  onChange={e => setIsAnonymous(e.target.checked)}
                  className='rounded'
                />
                <Label htmlFor='anonymous' className='text-sm cursor-pointer'>
                  {t('anonymous')}
                </Label>
              </div>
              <div className='space-y-2'>
                <Label>{t('message')}</Label>
                <Input value={message} onChange={e => setMessage(e.target.value)} />
              </div>
              <DialogFooter>
                <Button
                  type='submit'
                  disabled={donatePoints.isPending || !amount}
                  className='bg-primary-500 hover:bg-primary-500/90 text-white'
                >
                  {donatePoints.isPending ? t('submitting') : t('submit')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className='space-y-2'>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className='h-12 w-full rounded-lg' />
          ))}
        </div>
      ) : !donations || donations.length === 0 ? (
        <p className='text-sm text-muted-foreground text-center py-4'>{t('empty')}</p>
      ) : (
        <div className='space-y-2'>
          {donations.slice(0, 5).map((donation: DonationHistoryItem) => (
            <div
              key={donation.id}
              className='flex items-center justify-between rounded-lg border border-border p-3'
            >
              <div className='flex items-center gap-3'>
                <div className='size-8 rounded-full bg-pink-500/10 flex items-center justify-center'>
                  <Heart className='size-4 text-pink-500' />
                </div>
                <div>
                  <p className='text-sm font-medium'>
                    {donation.donationAmount} pts
                    {donation.isAnonymous && (
                      <span className='text-xs text-muted-foreground ms-1'>(anonymous)</span>
                    )}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    ~{donation.estimatedMeals} meals ·{' '}
                    {new Date(donation.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {donation.message && (
                <p className='text-xs text-muted-foreground italic max-w-[200px] truncate'>
                  &ldquo;{donation.message}&rdquo;
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Loyalty Page ──────────────────────────────────────────────────────

export function LoyaltyPage() {
  const t = useTranslations('dashboard.loyalty');
  const { data: stats, isLoading, isError, refetch } = useLoyaltyStats();

  if (isLoading) return <LoyaltySkeleton />;
  if (isError) return <ErrorState message={t('error')} onRetry={() => void refetch()} />;
  if (!stats) {
    return (
      <div className='glass rounded-2xl p-[24px] shadow-soft'>
        <div className='flex flex-col items-center justify-center py-10 gap-3 text-center'>
          <Award className='size-12 text-muted-foreground' />
          <h3 className='text-md font-semibold'>{t('empty.title')}</h3>
          <p className='text-sm text-muted-foreground max-w-xs'>{t('empty.description')}</p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: t('stats.totalPoints'), value: stats.totalPoints.toLocaleString(), icon: Star },
    { label: t('stats.bagsSaved'), value: stats.totalBagsSaved, icon: ShoppingBag },
    { label: t('stats.ordersCount'), value: stats.totalOrdersCount, icon: Gift },
    {
      label: t('stats.pointsThisMonth'),
      value: stats.availablePoints.toLocaleString(),
      icon: Award,
    },
  ];

  return (
    <div className='space-y-6'>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className='font-display text-3xl md:text-4xl text-primary-500 font-bold'>
          {t('title')}
        </h1>
        <p className='text-sm text-muted-foreground mt-1'>{t('subtitle')}</p>
      </motion.div>

      {/* Stats cards */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
              className='glass rounded-2xl p-[24px] shadow-soft relative overflow-hidden'
            >
              <div className='absolute -top-4 -end-4 w-20 h-20 rounded-full bg-brand-coral/10 blur-2xl' />
              <div className='relative'>
                <div className='h-11 w-11 rounded-xl bg-primary-500/[0.08] flex items-center justify-center mb-3'>
                  <Icon className='size-5 text-primary-500' />
                </div>
                <p className='text-xs text-muted-foreground'>{card.label}</p>
                <p className='font-display text-2xl text-primary-500 font-bold mt-1'>
                  {card.value}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Tier progress */}
      <TierProgress currentTier={stats.currentTier} totalPoints={stats.totalPoints} />

      {/* Two-column layout for badges + referral */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <BadgesSection />
        <ReferralSection />
      </div>

      {/* Gamification */}
      <GamificationSection />

      {/* Donations */}
      <DonationSection />
    </div>
  );
}
