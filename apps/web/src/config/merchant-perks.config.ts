import { Package, Wifi } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Merchant perks - what a shop earns by trading on the platform.
 *
 * ## The numbers here are NOT settled
 *
 * Every threshold and every discount below is a **placeholder**. The unit
 * economics have not been decided: what a data bundle costs us wholesale, what
 * margin a packaging supplier will give at volume, and how much of the 19%
 * commission each perk is allowed to consume before it stops paying for itself.
 *
 * They live in one file, typed and commented, so that decision is a single edit
 * rather than a hunt through JSX. Nothing else in the app hardcodes a tier.
 *
 * ## What the tiers must satisfy once the real numbers arrive
 *
 * For a perk to be worth running, the extra margin it produces has to exceed
 * what it costs. Per bag, the platform earns `subtotal * 0.19`. So for a tier
 * awarded at `bagsRequired` bags:
 *
 * ```
 *   perk cost  <  bagsRequired * averageSubtotal * 0.19 * upliftShare
 * ```
 *
 * where `upliftShare` is the share of that commission the perk is allowed to
 * spend. A perk given to a merchant who would have hit the threshold anyway
 * costs full price and returns nothing - the tiers have to sit above normal
 * behaviour, not under it.
 *
 * Until those figures exist the page presents perks as **available on request**
 * rather than auto-granting anything, so no obligation is created that the
 * economics have not been checked against.
 */

/** Not exported: consumers reach it as `Perk['id']`, so there is one name for it. */
type PerkId = 'internet' | 'packaging';

export interface PerkTier {
  /** Bags sold in the qualifying period. PLACEHOLDER - see the file note. */
  bagsRequired: number;
  /** i18n key under `merchantGifts.perks.<id>.tiers`. */
  labelKey: string;
}

export interface Perk {
  id: PerkId;
  icon: LucideIcon;
  /** Tailwind classes for the icon chip. Gold is the accent on light surfaces. */
  iconBg: string;
  iconColor: string;
  /** Ascending by `bagsRequired`; the UI relies on that order. */
  tiers: PerkTier[];
}

export const MERCHANT_PERKS: readonly Perk[] = Object.freeze([
  {
    id: 'internet',
    icon: Wifi,
    iconBg: 'bg-primary-500/[0.08]',
    iconColor: 'text-primary-500',
    tiers: [
      { bagsRequired: 50, labelKey: 'tier1' },
      { bagsRequired: 150, labelKey: 'tier2' },
      { bagsRequired: 300, labelKey: 'tier3' },
    ],
  },
  {
    id: 'packaging',
    icon: Package,
    iconBg: 'bg-secondary/[0.12]',
    iconColor: 'text-secondary',
    tiers: [
      { bagsRequired: 30, labelKey: 'tier1' },
      { bagsRequired: 100, labelKey: 'tier2' },
      { bagsRequired: 250, labelKey: 'tier3' },
    ],
  },
]);

/** The highest tier across all perks, for the progress bar's ceiling. */
export const MAX_PERK_TIER = Math.max(
  ...MERCHANT_PERKS.flatMap(p => p.tiers.map(t => t.bagsRequired)),
);

/**
 * The tier a merchant has reached, and the next one to aim at.
 *
 * `null` for `reached` means no tier yet; `null` for `next` means every tier is
 * unlocked. Both are distinguished rather than collapsed to zero, because the
 * screen says different things in each case.
 */
export function resolveTierProgress(
  perk: Perk,
  bagsSold: number,
): { reached: PerkTier | null; next: PerkTier | null } {
  // Tiers are ascending, so the last one at or below the count is the current
  // level and the first one above it is the target.
  const reached = [...perk.tiers].reverse().find(t => bagsSold >= t.bagsRequired) ?? null;
  const next = perk.tiers.find(t => bagsSold < t.bagsRequired) ?? null;

  return { reached, next };
}
