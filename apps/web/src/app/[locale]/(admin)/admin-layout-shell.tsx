'use client';

import { AuthGuard } from '@/components/guards/auth-guard';
import { RoleGuard } from '@/components/guards/role-guard';
import { Sidebar } from '@/components/dashboard/sidebar';
import { DashboardHeader } from '@/components/dashboard/header';
import { adminNavItems } from '@/config/navigation.config';
import { UserRole } from '@foodwaste/shared';

export function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.MODERATOR]}>
        <div className='fixed inset-0 flex flex-col bg-background'>
          {/* Header spans full width — sits above both sidebar and content */}
          <DashboardHeader navItems={adminNavItems} />

          {/* Body row: sidebar + scrollable content */}
          <div className='flex flex-1 min-h-0 overflow-hidden'>
            <Sidebar items={adminNavItems} />
            <main className='flex-1 overflow-y-auto overscroll-contain min-h-0 p-4 lg:p-6'>
              {children}
            </main>
          </div>
        </div>
      </RoleGuard>
    </AuthGuard>
  );
}
