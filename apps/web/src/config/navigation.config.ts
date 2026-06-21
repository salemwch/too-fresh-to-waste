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
    roles: [UserRole.MERCHANT], // location managers are not org owners
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
    titleKey: 'settings',
    href: '/merchant/settings',
    icon: Settings,
    roles: [UserRole.MERCHANT, UserRole.LOCATION_MANAGER],
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
    titleKey: 'communityGoal',
    href: '/admin/community-goal',
    icon: Trophy,
    roles: [UserRole.ADMIN],
  },
  {
    titleKey: 'drivers',
    href: '/admin/drivers',
    icon: Truck,
    roles: [UserRole.ADMIN],
  },
  {
    titleKey: 'voting',
    href: '/admin/voting',
    icon: Vote,
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
