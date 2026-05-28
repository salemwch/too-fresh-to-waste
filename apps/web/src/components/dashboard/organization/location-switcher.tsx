'use client';

import { MapPin, Building2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/lib/auth';
import { useMyEstablishments } from '@/hooks/use-merchant-dashboard';
import { useMyOrganization } from '@/hooks/use-organization';

export function LocationSwitcher() {
  const { user, activeEstablishmentId, setActiveEstablishmentId } = useAuthStore();
  const { data: org } = useMyOrganization();
  const { data: establishments } = useMyEstablishments();

  const isLocationManager = user?.role === 'location_manager';

  if (!org || isLocationManager) return null;
  if (!establishments || establishments.length <= 1) return null;

  return (
    <div className='mb-4'>
      <Select
        value={activeEstablishmentId ?? 'all'}
        onValueChange={val => setActiveEstablishmentId(val === 'all' ? null : val)}
      >
        <SelectTrigger className='w-full max-w-xs bg-primary/5 border-primary/20 text-sm'>
          <div className='flex items-center gap-2 truncate'>
            <MapPin className='size-4 shrink-0 text-primary' />
            <SelectValue placeholder='Select location' />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>
            <div className='flex items-center gap-2'>
              <Building2 className='size-4' />
              All Locations
            </div>
          </SelectItem>
          {establishments.map(est => (
            <SelectItem key={est._id} value={est._id}>
              <div className='flex flex-col'>
                <span className='font-medium'>{est.name}</span>
                <span className='text-xs text-muted-foreground'>{est.address?.city}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
