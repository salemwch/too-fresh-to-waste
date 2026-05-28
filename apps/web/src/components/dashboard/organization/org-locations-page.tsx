'use client';

import { Building2, MapPin, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyOrganization } from '@/hooks/use-organization';
import { useMyEstablishments } from '@/hooks/use-merchant-dashboard';
import { AddLocationDialog } from './add-location-dialog';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  suspended: 'bg-red-100 text-red-700 border-red-200',
};

export function OrgLocationsPage() {
  const { data: org, isLoading: orgLoading } = useMyOrganization();
  const { data: establishments, isLoading: estLoading } = useMyEstablishments();

  if (orgLoading || estLoading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-40 w-full' />
        <Skeleton className='h-40 w-full' />
      </div>
    );
  }

  if (!org) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center justify-center py-10 gap-3 text-center'>
          <Building2 className='size-12 text-muted-foreground' />
          <h3 className='text-md font-semibold'>No Organization Yet</h3>
          <p className='text-sm text-muted-foreground max-w-xs'>
            Upgrade to an enterprise account to manage multiple locations from one dashboard.
          </p>
          <Button>Create Organization</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>{org.name}</h1>
          <p className='text-sm text-muted-foreground'>
            {(establishments ?? []).length} location{(establishments ?? []).length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className='flex items-center gap-3'>
          <Badge className={statusColors[org.status] ?? statusColors['pending']}>
            {org.status}
          </Badge>
          <AddLocationDialog
            orgId={org._id}
            trigger={
              <Button size='sm'>
                <Plus className='size-4 me-2' />
                Add Location
              </Button>
            }
          />
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {(establishments ?? []).map(est => (
          <Card key={est._id} className='relative'>
            <CardHeader className='pb-3'>
              <div className='flex items-start justify-between'>
                <CardTitle className='text-base font-semibold'>{est.name}</CardTitle>
                <Badge
                  variant='outline'
                  className={statusColors[est.status ?? 'pending'] ?? statusColors['pending']}
                >
                  {est.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-2 text-sm'>
              <div className='flex items-center gap-2 text-muted-foreground'>
                <MapPin className='size-4 shrink-0' />
                <span>{est.address?.city ?? 'Address pending'}</span>
              </div>
              <div className='flex items-center gap-2 text-muted-foreground'>
                <Users className='size-4 shrink-0' />
                <span>No manager assigned</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
