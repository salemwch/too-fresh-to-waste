'use client';

import { UserRole } from '@foodwaste/shared';
import { RoleGuard } from '@/components/guards/role-guard';
import { OrgMembersPage } from '@/components/dashboard/organization/org-members-page';

export default function MembersPage() {
  return (
    <RoleGuard allowedRoles={[UserRole.MERCHANT]}>
      <OrgMembersPage />
    </RoleGuard>
  );
}
