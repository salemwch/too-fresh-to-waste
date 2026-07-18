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
  Settings,
  Activity,
  HeartHandshake,
  Truck,
  Vote,
  Star,
  Package,
  Wallet,
  BarChart3,
  ScrollText,
  Bell,
  Medal,
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
    titleKey: 'inventory',
    href: '/merchant/inventory',
    icon: Package,
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
        titleKey: 'drivers',
        href: '/admin/drivers',
        icon: Truck,
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
    ],
  },
  {
    groupKey: 'system',
    items: [
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

// Flat array derived from groups — used by mobile nav, header, and guards
export const adminNavItems: NavItem[] = adminNavGroups.flatMap(g => g.items);
