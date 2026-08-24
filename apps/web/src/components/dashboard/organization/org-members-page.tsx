'use client';

import { UserPlus, Mail, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useMyOrganization,
  useOrganizationInvitations,
  useRevokeInvitation,
} from '@/hooks/use-organization';
import { useMyEstablishments } from '@/hooks/use-merchant-dashboard';
import { InviteMemberDialog } from './invite-member-dialog';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  expired: 'bg-gray-100 text-gray-500',
  revoked: 'bg-red-100 text-red-600',
};

export function OrgMembersPage() {
  const { data: org, isLoading: orgLoading } = useMyOrganization();
  const { data: establishments } = useMyEstablishments();
  const { data: invitations, isLoading: invLoading } = useOrganizationInvitations(org?._id ?? '');
  const revoke = useRevokeInvitation(org?._id ?? '');

  if (orgLoading || invLoading) {
    return (
      <div className='space-y-lg'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-24 w-full' />
        <Skeleton className='h-24 w-full' />
      </div>
    );
  }

  if (!org) return null;

  return (
    <div className='space-y-2xl'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Team Members</h1>
          <p className='text-sm text-muted-foreground'>Manage location managers for {org.name}</p>
        </div>
        <InviteMemberDialog
          orgId={org._id}
          establishments={establishments ?? []}
          trigger={
            <Button size='sm'>
              <UserPlus className='size-4 me-sm' />
              Invite Manager
            </Button>
          }
        />
      </div>

      {!invitations || invitations.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-6xl gap-md text-center'>
            <UserPlus className='size-12 text-muted-foreground' />
            <h3 className='text-md font-semibold'>No invitations yet</h3>
            <p className='text-sm text-muted-foreground max-w-xs'>
              Invite location managers so they can manage their assigned location with their own
              account.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-md'>
          {invitations.map(inv => (
            <Card key={inv._id}>
              <CardContent className='flex items-center justify-between py-lg'>
                <div className='flex items-center gap-lg'>
                  <div className='size-10 rounded-full bg-muted flex items-center justify-center'>
                    <Mail className='size-5 text-muted-foreground' />
                  </div>
                  <div>
                    <p className='text-sm font-medium'>{inv.email}</p>
                    <p className='text-xs text-muted-foreground'>Location Manager</p>
                  </div>
                </div>

                <div className='flex items-center gap-md'>
                  <Badge className={statusColors[inv.status] ?? ''}>{inv.status}</Badge>
                  {inv.status === 'pending' && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => revoke.mutate(inv._id)}
                      disabled={revoke.isPending}
                    >
                      <XCircle className='size-4 text-destructive' />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
