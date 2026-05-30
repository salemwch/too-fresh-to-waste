'use client';

import { UserRole } from '@foodwaste/shared';
import { RoleGuard } from '@/components/guards/role-guard';
import { OrgLocationsPage } from '@/components/dashboard/organization/org-locations-page';

export default function OrganizationPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.MERCHANT]}>
      <OrgLocationsPage />
    </RoleGuard>
  );
}
