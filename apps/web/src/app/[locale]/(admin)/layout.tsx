'use client';

import { AuthGuard } from '@/components/guards/auth-guard';
import { RoleGuard } from '@/components/guards/role-guard';
import { Sidebar } from '@/components/dashboard/sidebar';
import { DashboardHeader } from '@/components/dashboard/header';
import { adminNavItems } from '@/config/navigation.config';
import { UserRole } from '@foodwaste/shared';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AuthGuard>
      <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.MODERATOR]}>
        <div className='flex h-screen overflow-hidden bg-background'>
          <Sidebar items={adminNavItems} />
          <div className='flex-1 flex flex-col overflow-hidden'>
            <DashboardHeader navItems={adminNavItems} />
            <main className='flex-1 overflow-y-auto p-4 lg:p-6'>{children}</main>
          </div>
        </div>
      </RoleGuard>
    </AuthGuard>
  );
}
