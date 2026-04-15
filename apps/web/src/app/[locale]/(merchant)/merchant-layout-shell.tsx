'use client';

import { AuthGuard } from '@/components/guards/auth-guard';
import { RoleGuard } from '@/components/guards/role-guard';
import { Sidebar } from '@/components/dashboard/sidebar';
import { DashboardHeader } from '@/components/dashboard/header';
import { TrialStatusBanner } from '@/components/dashboard/merchant';
import { merchantNavItems } from '@/config/navigation.config';
import { useMerchantOrdersSocket } from '@/hooks/use-merchant-orders-socket';
import { UserRole } from '@foodwaste/shared';

export function MerchantLayoutShell({ children }: { children: React.ReactNode }) {
  // Mount the WebSocket connection at layout level so the notification bell
  // in the header receives new-order events from any merchant page.
  useMerchantOrdersSocket();

  return (
    <AuthGuard>
      <RoleGuard allowedRoles={[UserRole.MERCHANT]}>
        <div className='flex flex-col h-screen bg-background'>
          {/* Header spans full width — sits above both sidebar and content */}
          <DashboardHeader navItems={merchantNavItems} />

          {/* Body row: sidebar + scrollable content */}
          <div className='flex flex-1 min-h-0'>
            <Sidebar items={merchantNavItems} />
            <main className='flex-1 overflow-y-auto overscroll-contain min-h-0 px-4 py-3 lg:px-8 lg:py-3'>
              <div className='mb-3'>
                <TrialStatusBanner />
              </div>
              {children}
            </main>
          </div>
        </div>
      </RoleGuard>
    </AuthGuard>
  );
}
