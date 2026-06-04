'use client';

import { MapPin, Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
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

  const selectedLabel = activeEstablishmentId
    ? (establishments.find(e => e._id === activeEstablishmentId)?.name ?? 'Location')
    : 'All Locations';

  return (
    <Select
      value={activeEstablishmentId ?? 'all'}
      onValueChange={val => setActiveEstablishmentId(val === 'all' ? null : val)}
    >
      <SelectTrigger className='w-auto min-w-[140px] max-w-[220px] h-[38px] gap-1.5 rounded-full glass shadow-soft border-0 px-3 text-[12px] font-medium text-primary-500 hover:bg-primary-500/[0.06] transition-colors'>
        <MapPin className='size-3.5 shrink-0 text-primary-500/60' />
        <span className='truncate'>{selectedLabel}</span>
      </SelectTrigger>
      <SelectContent align='end'>
        <SelectItem value='all'>
          <div className='flex items-center gap-2'>
            <Building2 className='size-3.5' />
            All Locations
          </div>
        </SelectItem>
        {establishments.map(est => (
          <SelectItem key={est._id} value={est._id}>
            <div className='flex flex-col'>
              <span className='font-medium'>{est.name}</span>
              {est.address?.city && (
                <span className='text-xs text-muted-foreground'>{est.address.city}</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
