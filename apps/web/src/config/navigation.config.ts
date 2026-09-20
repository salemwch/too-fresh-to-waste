import {
  LayoutDashboard,
  Store,
  Tag,
  ShoppingBag,
  PieChart,
  Leaf,
  Users,
  Trophy,
  Building2,
  Shield,
  ShieldAlert,
  Settings,
  Activity,
  HeartHandshake,
  Truck,
  Vote,
  Star,
  Wallet,
  BarChart3,
  ScrollText,
  Bell,
  Medal,
  MapPin,
  Megaphone,
  Ticket,
  UserCog,
  Network,
  Percent,
  MessageSquare,
  Gift,
  type LucideIcon,
} from 'lucide-react';
import { UserRole } from '@foodwaste/shared';

export interface NavItem {
  titleKey: string; // i18n key under 'dashboard.nav'
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  badge?: number; // optional badge counter
}

export interface NavGroup {
  groupKey: string; // i18n key under 'dashboard.nav.groups'
  items: NavItem[];
}

/**
 * Keep only the destinations `role` is allowed to reach, dropping groups left
 * with nothing in them.
 *
 * Every item already declares its `roles`, but the admin shell used to hand the
 * raw list to the sidebar, so a moderator saw all 23 entries when the backend
 * grants them 6. Clicking any of the other 17 produced a 403 from a screen that
 * looked available — the navigation promised authority the server was always
 * going to refuse.
 *
 * This is presentation, not protection: the real gate is the backend's @Roles
 * guards, plus RoleGuard on the route group. Hiding a link never makes an
 * endpoint safe.
 */
export function filterNavGroupsByRole(groups: NavGroup[], role: UserRole | undefined): NavGroup[] {
  if (!role) return [];

  return groups
    .map(group => ({ ...group, items: group.items.filter(item => item.roles.includes(role)) }))
    .filter(group => group.items.length > 0);
}

/**
 * Whether `role` may open `pathname`, judged by the nav entry that owns it.
 *
 * Matching is by longest href prefix, so detail routes inherit their section's
 * rule — /admin/users/42 is governed by the /admin/users entry. A path no entry
 * claims is allowed: the nav does not describe every route, and this must not
 * become a second, half-complete access list that silently locks people out of
 * pages nobody remembered to add.
 *
 * Presentation again, not protection. Hiding the link stops the accident;
 * this stops the typed URL; only the backend's @Roles guards stop an attacker.
 *
 * `pathname` must already have the locale prefix stripped — use `usePathname`
 * from `@/i18n/routing`, not `next/navigation`.
 */
export function isNavPathAllowedForRole(
  groups: NavGroup[],
  pathname: string,
  role: UserRole | undefined,
): boolean {
  if (!role) return false;

  let owner: NavItem | undefined;
  for (const group of groups) {
    for (const item of group.items) {
      const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (matches && (!owner || item.href.length > owner.href.length)) {
        owner = item;
      }
    }
  }

  return owner ? owner.roles.includes(role) : true;
}

export const merchantNavItems: NavItem[] = [
  {
    titleKey: 'dashboard',
    href: '/merchant/dashboard',
    icon: LayoutDashboard,
    roles: [UserRole.MERCHANT, UserRole.LOCATION_MANAGER],
  },
  {
    titleKey: 'establishment',
    href: '/merchant/establishment',
    icon: Store,
    roles: [UserRole.MERCHANT, UserRole.LOCATION_MANAGER],
  },
  {
    titleKey: 'organization',
    href: '/merchant/organization',
    icon: Building2,
    roles: [UserRole.MERCHANT],
  },
  {
    titleKey: 'offers',
    href: '/merchant/offers',
    icon: Tag,
    roles: [UserRole.MERCHANT, UserRole.LOCATION_MANAGER],
  },
  {
    titleKey: 'orders',
    href: '/merchant/orders',
    icon: ShoppingBag,
    roles: [UserRole.MERCHANT, UserRole.LOCATION_MANAGER],
  },
  {
    titleKey: 'analytics',
    href: '/merchant/analytics',
    icon: PieChart,
    roles: [UserRole.MERCHANT, UserRole.LOCATION_MANAGER],
  },
  {
    titleKey: 'reviews',
    href: '/merchant/reviews',
    icon: Star,
    roles: [UserRole.MERCHANT, UserRole.LOCATION_MANAGER],
  },
  {
    titleKey: 'esg',
    href: '/merchant/esg',
    icon: Leaf,
    roles: [UserRole.MERCHANT, UserRole.LOCATION_MANAGER],
  },
  {
    titleKey: 'community',
    href: '/merchant/community',
    icon: Users,
    roles: [UserRole.MERCHANT, UserRole.LOCATION_MANAGER],
  },
  {
    titleKey: 'leaderboard',
    href: '/merchant/leaderboard',
    icon: Trophy,
    roles: [UserRole.MERCHANT, UserRole.LOCATION_MANAGER],
  },
  {
    titleKey: 'gifts',
    href: '/merchant/gifts',
    icon: Gift,
    roles: [UserRole.MERCHANT, UserRole.LOCATION_MANAGER],
  },
  {
    titleKey: 'payments',
    href: '/merchant/payments',
    icon: Wallet,
    roles: [UserRole.MERCHANT],
  },
  {
    titleKey: 'settings',
    href: '/merchant/settings',
    icon: Settings,
    roles: [UserRole.MERCHANT, UserRole.LOCATION_MANAGER],
  },
];

// ── Admin: grouped navigation ────────────────────────────────────────────────

export const adminNavGroups: NavGroup[] = [
  {
    groupKey: 'overview',
    items: [
      {
        titleKey: 'dashboard',
        href: '/admin/dashboard',
        icon: LayoutDashboard,
        roles: [UserRole.ADMIN, UserRole.MODERATOR],
      },
      {
        titleKey: 'analyticsReports',
        href: '/admin/analytics',
        icon: BarChart3,
        roles: [UserRole.ADMIN],
      },
    ],
  },
  {
    groupKey: 'peopleAndPlaces',
    items: [
      {
        titleKey: 'users',
        href: '/admin/users',
        icon: Users,
        roles: [UserRole.ADMIN, UserRole.MODERATOR],
      },
      {
        titleKey: 'establishments',
        href: '/admin/establishments',
        icon: Building2,
        roles: [UserRole.ADMIN, UserRole.MODERATOR],
      },
      {
        titleKey: 'organizations',
        href: '/admin/organizations',
        icon: Network,
        roles: [UserRole.ADMIN],
      },
      {
        titleKey: 'drivers',
        href: '/admin/drivers',
        icon: Truck,
        roles: [UserRole.ADMIN],
      },
      {
        titleKey: 'supportTickets',
        href: '/admin/support-tickets',
        icon: Ticket,
        roles: [UserRole.ADMIN, UserRole.MODERATOR],
      },
      {
        titleKey: 'geozones',
        href: '/admin/geozones',
        icon: MapPin,
        roles: [UserRole.ADMIN],
      },
    ],
  },
  {
    groupKey: 'marketplace',
    items: [
      {
        titleKey: 'adminOffers',
        href: '/admin/offers',
        icon: Tag,
        roles: [UserRole.ADMIN],
      },
      {
        titleKey: 'ordersDisputes',
        href: '/admin/orders',
        icon: ShoppingBag,
        roles: [UserRole.ADMIN],
      },
      {
        titleKey: 'adminReviews',
        href: '/admin/reviews',
        icon: MessageSquare,
        roles: [UserRole.ADMIN, UserRole.MODERATOR],
      },
      {
        titleKey: 'moderation',
        href: '/admin/moderation',
        icon: Shield,
        roles: [UserRole.ADMIN, UserRole.MODERATOR],
      },
    ],
  },
  {
    groupKey: 'finance',
    items: [
      {
        titleKey: 'paymentsPayouts',
        href: '/admin/payments',
        icon: Wallet,
        roles: [UserRole.ADMIN],
      },
      {
        titleKey: 'commission',
        href: '/admin/commission',
        icon: Percent,
        roles: [UserRole.ADMIN],
      },
    ],
  },
  {
    groupKey: 'engagement',
    items: [
      {
        titleKey: 'donationPool',
        href: '/admin/donations',
        icon: HeartHandshake,
        roles: [UserRole.ADMIN],
      },
      {
        titleKey: 'communityGoal',
        href: '/admin/community-goal',
        icon: Trophy,
        roles: [UserRole.ADMIN],
      },
      {
        titleKey: 'voting',
        href: '/admin/voting',
        icon: Vote,
        roles: [UserRole.ADMIN],
      },
      {
        titleKey: 'leaderboardsRewards',
        href: '/admin/leaderboards',
        icon: Medal,
        roles: [UserRole.ADMIN],
      },
      {
        titleKey: 'notifications',
        href: '/admin/notifications',
        icon: Bell,
        roles: [UserRole.ADMIN],
      },
      {
        titleKey: 'announcements',
        href: '/admin/announcements',
        icon: Megaphone,
        roles: [UserRole.ADMIN, UserRole.MODERATOR],
      },
    ],
  },
  {
    groupKey: 'system',
    items: [
      {
        titleKey: 'team',
        href: '/admin/team',
        icon: UserCog,
        roles: [UserRole.ADMIN],
      },
      {
        titleKey: 'securityDashboard',
        href: '/admin/security',
        icon: ShieldAlert,
        roles: [UserRole.ADMIN],
      },
      {
        titleKey: 'auditLog',
        href: '/admin/audit-log',
        icon: ScrollText,
        roles: [UserRole.ADMIN],
      },
      {
        titleKey: 'health',
        href: '/admin/health',
        icon: Activity,
        roles: [UserRole.ADMIN],
      },
      {
        titleKey: 'settings',
        href: '/admin/settings',
        icon: Settings,
        roles: [UserRole.ADMIN],
      },
    ],
  },
];
