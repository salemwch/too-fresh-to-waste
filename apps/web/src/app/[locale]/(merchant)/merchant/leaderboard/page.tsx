'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, Medal, MoreHorizontal, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import {
  useLeaderboard,
  useMerchantRank,
  useUpdateLeaderboardPreference,
} from '@/hooks/use-merchant-dashboard';
import { LocationSwitcher } from '@/components/dashboard/organization/location-switcher';
import type { LeaderboardEntry } from '@/types/dashboard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

// ── Rank medal for top 3 ─────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown size={16} className='text-yellow-500' />;
  if (rank === 2) return <Medal size={16} className='text-slate-400' />;
  if (rank === 3) return <Medal size={16} className='text-amber-600' />;
  return (
    <span className='text-[12px] font-semibold text-primary-500/50 tabular-nums w-[20px] text-center'>
      {rank}
    </span>
  );
}

// ── First-visit privacy choice (blocks until merchant decides) ──────────────

function PrivacyChoiceDialog({
  onChoose,
  isPending,
}: {
  onChoose: (anonymous: boolean) => void;
  isPending: boolean;
}) {
  return (
    <Dialog open>
      <DialogContent
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
        className='[&>button]:hidden sm:max-w-md'
      >
        <DialogHeader>
          <DialogTitle className='text-primary-500'>Leaderboard Visibility</DialogTitle>
          <DialogDescription>
            Choose how you appear on the leaderboard. All merchants can see this ranking.
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-md pt-sm'>
          <button
            onClick={() => onChoose(false)}
            disabled={isPending}
            className='flex items-center gap-lg p-lg rounded-xl border border-primary-500/10 hover:border-primary-500/30 hover:bg-primary-500/[0.03] transition-colors text-start disabled:opacity-50'
          >
            <div className='h-10 w-10 rounded-full bg-primary-500/10 grid place-items-center shrink-0'>
              <Eye size={18} className='text-primary-500' />
            </div>
            <div>
              <div className='text-sm font-semibold text-primary-500'>Use my name & photo</div>
              <div className='text-xs text-primary-500/50 mt-xxs'>
                Your real name and profile image will be visible
              </div>
            </div>
          </button>

          <button
            onClick={() => onChoose(true)}
            disabled={isPending}
            className='flex items-center gap-lg p-lg rounded-xl border border-primary-500/10 hover:border-primary-500/30 hover:bg-primary-500/[0.03] transition-colors text-start disabled:opacity-50'
          >
            <div className='h-10 w-10 rounded-full bg-primary-500/10 grid place-items-center shrink-0'>
              <EyeOff size={18} className='text-primary-500' />
            </div>
            <div>
              <div className='text-sm font-semibold text-primary-500'>Stay anonymous</div>
              <div className='text-xs text-primary-500/50 mt-xxs'>
                You&apos;ll appear as &ldquo;Anonymous&rdquo; with a default avatar
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Single leaderboard row ───────────────────────────────────────────────────

function LeaderboardRow({
  entry,
  isMe,
  onToggleVisibility,
  isToggling,
}: {
  entry: LeaderboardEntry;
  isMe: boolean;
  onToggleVisibility?: () => void;
  isToggling?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex items-center gap-[14px] px-[16px] py-[12px] rounded-2xl transition-colors ${
        isMe ? 'bg-brand-coral/[0.06] border border-brand-coral/20' : 'hover:bg-primary-500/[0.03]'
      }`}
    >
      <div className='w-[24px] flex justify-center shrink-0'>
        <RankBadge rank={entry.rank} />
      </div>

      {entry.profileImage ? (
        <img
          src={entry.profileImage}
          alt={entry.displayName}
          className='h-[36px] w-[36px] rounded-full object-cover shrink-0'
        />
      ) : (
        <div className='h-[36px] w-[36px] rounded-full bg-primary-500/10 grid place-items-center shrink-0 text-[13px] font-bold text-primary-500'>
          {entry.displayName[0]?.toUpperCase() ?? '?'}
        </div>
      )}

      <div className='flex-1 min-w-0'>
        <div className='text-[13px] font-medium text-primary-500 truncate'>
          {entry.displayName}
          {isMe && (
            <span className='ms-sm text-[10px] text-brand-coral font-semibold uppercase tracking-wide'>
              You
            </span>
          )}
        </div>
      </div>

      <div className='text-end shrink-0'>
        <div className='text-[14px] font-semibold text-primary-500 tabular-nums'>
          {entry.mealsSaved}
        </div>
        <div className='text-[10px] text-primary-500/50'>meals</div>
      </div>

      {isMe && onToggleVisibility && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className='p-1.5 rounded-lg hover:bg-primary-500/[0.06] transition-colors shrink-0'>
              <MoreHorizontal size={16} className='text-primary-500/40' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem
              onClick={onToggleVisibility}
              {...(isToggling ? { disabled: true } : {})}
            >
              {entry.isAnonymous ? (
                <>
                  <Eye size={14} />
                  <span>Show my name & photo</span>
                </>
              ) : (
                <>
                  <EyeOff size={14} />
                  <span>Go anonymous</span>
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </motion.div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const user = useAuthStore(s => s.user);

  const leaderboardQuery = useLeaderboard(50);
  const rankQuery = useMerchantRank();
  const updatePreference = useUpdateLeaderboardPreference();

  const [visibleCount, setVisibleCount] = useState(15);

  const needsChoice =
    user?.leaderboardAnonymous === null || user?.leaderboardAnonymous === undefined;

  const allEntries = leaderboardQuery.data ?? [];
  const visibleEntries = allEntries.slice(0, visibleCount);
  const hasMore = visibleCount < allEntries.length;

  const myRank = rankQuery.data?.rank ?? 0;
  const myMeals = rankQuery.data?.mealsSaved ?? 0;
  const totalParticipants = rankQuery.data?.totalParticipants ?? 0;
  const myPercentile = rankQuery.data?.percentile ?? 0;

  return (
    <>
      {needsChoice && (
        <PrivacyChoiceDialog
          onChoose={anonymous => updatePreference.mutate(anonymous)}
          isPending={updatePreference.isPending}
        />
      )}

      <div className='space-y-[28px]'>
        {/* Header */}
        <div className='flex items-start justify-between gap-lg flex-wrap'>
          <div>
            <h1 className='font-display text-3xl text-primary-500'>Leaderboard</h1>
            <p className='text-primary-500/60 text-sm mt-xs'>
              Merchants ranked by meals saved (confirmed paid orders).
            </p>
          </div>
          <LocationSwitcher />
        </div>

        {/* My rank summary card */}
        {myRank > 0 && (
          <div className='glass rounded-2xl p-[24px] shadow-soft flex items-center gap-[24px] flex-wrap'>
            <div className='flex-1 min-w-[160px]'>
              <div className='text-[10px] uppercase tracking-wider text-primary-500/60 mb-xs'>
                Your Rank
              </div>
              <div className='font-display text-5xl text-brand-coral tabular-nums'>#{myRank}</div>
              <div className='text-xs text-primary-500/50 mt-xs'>
                of {totalParticipants} establishments
              </div>
            </div>

            <div className='flex-1 min-w-[120px]'>
              <div className='text-[10px] uppercase tracking-wider text-primary-500/60 mb-xs'>
                Meals Saved
              </div>
              <div className='font-display text-4xl text-primary-500 tabular-nums'>{myMeals}</div>
            </div>

            <div className='flex-1 min-w-[120px]'>
              <div className='text-[10px] uppercase tracking-wider text-primary-500/60 mb-sm'>
                Percentile
              </div>
              <div className='h-[6px] w-full rounded-full bg-primary-500/[0.08] overflow-hidden'>
                <motion.div
                  className='h-full rounded-full bg-brand-coral'
                  initial={{ width: 0 }}
                  animate={{ width: `${myPercentile}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                />
              </div>
              <div className='text-xs text-primary-500/60 mt-xs'>Top {100 - myPercentile + 1}%</div>
            </div>
          </div>
        )}

        {/* Leaderboard list */}
        <div className='glass rounded-2xl shadow-soft overflow-hidden'>
          <div className='flex items-center gap-sm px-[20px] py-[16px] border-b border-primary-500/[0.06]'>
            <Trophy size={16} className='text-brand-coral' />
            <span className='text-[13px] font-semibold text-primary-500'>Top Merchants</span>
          </div>

          {leaderboardQuery.isLoading ? (
            <div className='p-[20px] space-y-[10px]'>
              {[...Array(8)].map((_, i) => (
                <div key={i} className='h-[60px] rounded-2xl bg-primary-500/[0.04] animate-pulse' />
              ))}
            </div>
          ) : allEntries.length > 0 ? (
            <div className='p-[12px] space-y-[4px]'>
              {visibleEntries.map(entry => {
                const isMe = entry.userId === user?.userId;
                return (
                  <LeaderboardRow
                    key={entry.userId}
                    entry={entry}
                    isMe={isMe}
                    {...(isMe
                      ? {
                          onToggleVisibility: () => updatePreference.mutate(!entry.isAnonymous),
                          isToggling: updatePreference.isPending,
                        }
                      : {})}
                  />
                );
              })}

              {hasMore && (
                <div className='flex justify-center pt-md pb-xs'>
                  <button
                    onClick={() => setVisibleCount(c => c + 15)}
                    className='text-[13px] font-medium text-primary-500/60 hover:text-primary-500 px-xl py-sm rounded-xl hover:bg-primary-500/[0.04] transition-colors'
                  >
                    Load more
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className='flex flex-col items-center justify-center py-[48px] text-center px-[24px]'>
              <Trophy size={32} className='text-primary-500/20 mb-md' />
              <p className='text-primary-500/50 text-sm'>No rankings yet. Be the first!</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
