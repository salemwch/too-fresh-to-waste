'use client';

import { AnalyticsPage } from '@/components/dashboard/merchant/analytics/analytics-page';
import { ProGate } from '@/components/dashboard/merchant/pro-gate';

export default function MerchantAnalyticsPage() {
  return (
    <ProGate>
      <AnalyticsPage />
    </ProGate>
  );
}
