'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Navigation, Radio, SignalLow, WifiOff } from 'lucide-react';
import { AdminModuleHeader } from '@/components/dashboard/admin/admin-module-header';
import { AdminKpiRow, type KpiItem } from '@/components/dashboard/admin/admin-kpi-row';
import { DriverFleetMap } from '@/components/dashboard/admin/driver-fleet-map';
import { DriverFleetPanel } from '@/components/dashboard/admin/driver-fleet-panel';
import { useLiveFleet } from '@/hooks/use-drivers';
import type { DriverActivity, LiveDriver } from '@/types/admin';

/**
 * Stable identity for "fleet not loaded yet".
 *
 * `?? []` would hand the map and the panel a new array every render, and both
 * memoise on it - .claude/rules/performance.md rule 1.
 */
const NO_DRIVERS: readonly LiveDriver[] = Object.freeze([]);

const EMPTY_COUNTS: Record<DriverActivity, number> = Object.freeze({
  en_route: 0,
  idle: 0,
  stale: 0,
  offline: 0,
});

/**
 * Live dispatch map.
 *
 * Its own route rather than a tab on `/admin/drivers` for two reasons: that
 * page is already a KPI row, a create form, a paginated table and two dialogs;
 * and this one polls. Mounting a polling query behind a tab nobody opened
 * means paying for it on a page about provisioning driver accounts.
 */
export default function DriverMapPage() {
  const t = useTranslations('adminDrivers.map');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError } = useLiveFleet();
  const drivers = data ?? NO_DRIVERS;

  const counts = useMemo(() => {
    const next = { ...EMPTY_COUNTS };
    for (const driver of drivers) next[driver.activity]++;
    return next;
  }, [drivers]);

  const kpis: KpiItem[] = [
    { label: t('kpi.enRoute'), value: String(counts.en_route), icon: Navigation },
    { label: t('kpi.idle'), value: String(counts.idle), icon: Radio },
    {
      label: t('kpi.stale'),
      value: String(counts.stale),
      icon: SignalLow,
      // The only tile that ever needs action - a driver who is nominally
      // online while the heartbeat has stopped. Highlighted only when there
      // actually is one, so the colour keeps meaning something.
      ...(counts.stale > 0 ? { highlight: true } : {}),
    },
    { label: t('kpi.offline'), value: String(counts.offline), icon: WifiOff },
  ];

  if (isError) {
    return (
      <div className='space-y-xl'>
        <AdminModuleHeader title={t('title')} subtitle={t('subtitle')} />
        <div className='rounded-lg border border-border/60 bg-card py-3xl text-center'>
          <p className='text-sm text-muted-foreground'>{t('error')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-xl'>
      <AdminModuleHeader title={t('title')} subtitle={t('subtitle')} />

      <AdminKpiRow items={kpis} loading={isLoading} columns={4} />

      {/*
        Map and list side by side on desktop, stacked on mobile with the list
        first. On a phone the list is the usable half - a map at 100vw minus
        padding is too small to pick a marker out of - so it leads, and the map
        follows as context.
      */}
      <div className='grid gap-lg lg:grid-cols-[1fr_360px]'>
        <div className='order-2 min-h-[420px] lg:order-1'>
          <DriverFleetMap
            drivers={drivers}
            isLoading={isLoading}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div className='order-1 lg:order-2 lg:max-h-[640px] lg:overflow-y-auto lg:pe-xs'>
          <DriverFleetPanel
            drivers={drivers}
            isLoading={isLoading}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>
    </div>
  );
}
