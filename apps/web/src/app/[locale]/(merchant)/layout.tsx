'use client';

import { AuthGuard } from '@/components/guards/auth-guard';
import { RoleGuard } from '@/components/guards/role-guard';
import { Sidebar } from '@/components/dashboard/sidebar';
import { DashboardHeader } from '@/components/dashboard/header';
import { merchantNavItems } from '@/config/navigation.config';
import { UserRole } from '@foodwaste/shared';

interface MerchantLayoutProps {
  children: React.ReactNode;
}

export default function MerchantLayout({ children }: MerchantLayoutProps) {
  return (
    <AuthGuard>
      <RoleGuard allowedRoles={[UserRole.MERCHANT]}>
        <div className="flex flex-col h-screen bg-background">
          {/* Header spans full width — sits above both sidebar and content */}
          <DashboardHeader navItems={merchantNavItems} />

          {/* Body row: sidebar + scrollable content */}
          <div className="flex flex-1 min-h-0">
            <Sidebar items={merchantNavItems} />
            <main className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 lg:px-8 lg:py-3">
              {children}
            </main>
          </div>
        </div>
      </RoleGuard>
    </AuthGuard>
  );
}
