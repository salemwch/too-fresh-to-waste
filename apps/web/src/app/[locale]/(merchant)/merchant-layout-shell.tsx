'use client';

import { AuthGuard } from '@/components/guards/auth-guard';
import { RoleGuard } from '@/components/guards/role-guard';
import { Sidebar } from '@/components/dashboard/sidebar';
import { TrialStatusBanner } from '@/components/dashboard/merchant';
import { MobileNav } from '@/components/dashboard/mobile-nav';
import { NotificationBell } from '@/components/dashboard/notification-panel';
import { UserNav } from '@/components/dashboard/user-nav';
import { merchantNavItems } from '@/config/navigation.config';
import { useMerchantOrdersSocket } from '@/hooks/use-merchant-orders-socket';
import { useAuthStore } from '@/lib/auth';
import { UserRole } from '@foodwaste/shared';

export function MerchantLayoutShell({ children }: { children: React.ReactNode }) {
  useMerchantOrdersSocket();
  const userRole = useAuthStore(s => s.user?.role as UserRole | undefined);
  const visibleNavItems = merchantNavItems.filter(item =>
    userRole ? item.roles.includes(userRole) : false,
  );

  return (
    <AuthGuard>
      <RoleGuard allowedRoles={[UserRole.MERCHANT, UserRole.LOCATION_MANAGER]}>
        <div className='flex h-screen bg-dashboard'>
          {/* Desktop teal sidebar — hidden on mobile */}
          <Sidebar items={visibleNavItems} />

          <div className='flex flex-col flex-1 min-w-0'>
            {/* Mobile header — only visible below xl breakpoint */}
            <header className='xl:hidden shrink-0 z-40 bg-primary-500 text-white px-[16px] py-3 flex items-center justify-between gap-3'>
              <MobileNav items={visibleNavItems} />
              <span className='font-display font-semibold text-base tracking-tight'>
                Too Fresh to Waste
              </span>
              <div className='flex items-center gap-2'>
                <NotificationBell />
                <UserNav />
              </div>
            </header>

            {/* Scrollable main content */}
            <main className='flex-1 overflow-y-auto overscroll-contain min-h-0 px-[16px] py-[24px] lg:px-[32px] lg:py-[40px]'>
              <div className='max-w-[1400px] mx-auto'>
                <div className='mb-[16px]'>
                  <TrialStatusBanner />
                </div>
                {children}
              </div>
            </main>
          </div>
        </div>
      </RoleGuard>
    </AuthGuard>
  );
}
