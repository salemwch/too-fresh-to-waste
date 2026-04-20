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

export const merchantNavItems: NavItem[] = [
  {
    titleKey: 'dashboard',
    href: '/merchant/dashboard',
    icon: LayoutDashboard,
    roles: [UserRole.MERCHANT],
  },
  {
    titleKey: 'establishment',
    href: '/merchant/establishment',
    icon: Store,
    roles: [UserRole.MERCHANT],
  },
  {
    titleKey: 'offers',
    href: '/merchant/offers',
    icon: Tag,
    roles: [UserRole.MERCHANT],
  },
  {
    titleKey: 'orders',
    href: '/merchant/orders',
    icon: ShoppingBag,
    roles: [UserRole.MERCHANT],
  },
  {
    titleKey: 'analytics',
    href: '/merchant/analytics',
    icon: PieChart,
    roles: [UserRole.MERCHANT],
  },
  {
    titleKey: 'esg',
    href: '/merchant/esg',
    icon: Leaf,
    roles: [UserRole.MERCHANT],
  },
  {
    titleKey: 'community',
    href: '/merchant/community',
    icon: Users,
    roles: [UserRole.MERCHANT],
  },
  {
    titleKey: 'leaderboard',
    href: '/merchant/leaderboard',
    icon: Trophy,
    roles: [UserRole.MERCHANT],
  },
  {
    titleKey: 'settings',
    href: '/merchant/settings',
    icon: Settings,
    roles: [UserRole.MERCHANT],
  },
];

export const adminNavItems: NavItem[] = [
  {
    titleKey: 'dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    roles: [UserRole.ADMIN, UserRole.MODERATOR],
  },
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
    titleKey: 'moderation',
    href: '/admin/moderation',
    icon: Shield,
    roles: [UserRole.ADMIN, UserRole.MODERATOR],
  },
  {
    titleKey: 'adminOffers',
    href: '/admin/offers',
    icon: Tag,
    roles: [UserRole.ADMIN],
  },
  {
    titleKey: 'donationPool',
    href: '/admin/donations',
    icon: HeartHandshake,
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
];
