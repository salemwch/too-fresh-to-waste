'use client';

import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@foodwaste/ui';
import { Users, Building2, ShoppingBag, AlertTriangle } from 'lucide-react';

export default function AdminDashboardPage() {
  const t = useTranslations('dashboard');
  const user = useAuthStore((state) => state.user);

  const stats = [
    { titleKey: 'totalUsers', value: '--', icon: Users },
    { titleKey: 'totalEstablishments', value: '--', icon: Building2 },
    { titleKey: 'totalOrders', value: '--', icon: ShoppingBag },
    { titleKey: 'pendingReviews', value: '--', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('welcome', { name: user?.firstName ?? '' })}
        </h1>
        <p className="text-muted-foreground">{t('adminDashboardDescription')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.titleKey}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{t(`stats.${stat.titleKey}`)}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <CardDescription className="text-xs">{t('comingSoon')}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('systemOverview')}</CardTitle>
          <CardDescription>{t('systemOverviewDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
