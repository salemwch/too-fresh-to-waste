'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, Plus, MoreHorizontal, Trash2, Building2 } from 'lucide-react';
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@foodwaste/ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmActionDialog } from '@/components/dashboard/admin/confirm-action-dialog';
import {
  useGeozones,
  useGeozoneStats,
  useCreateGeozone,
  useUpdateGeozone,
  useDeleteGeozone,
} from '@/hooks/use-admin';
import type {
  GeozoneRow,
  GeozoneSearchParams,
  GeozoneStatus,
  CreateGeozonePayload,
} from '@/types/admin';

const STATUS_COLORS: Record<GeozoneStatus, string> = {
  active: 'bg-green-500/10 text-green-700',
  inactive: 'bg-muted text-muted-foreground',
  coming_soon: 'bg-blue-500/10 text-blue-600',
};

export default function GeozonesPage() {
  const t = useTranslations('adminGeozones');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const params: GeozoneSearchParams = {
    page: 1,
    limit: 50,
    ...(search ? { search } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter as GeozoneStatus } : {}),
  };

  const { data: zones, isLoading } = useGeozones(params);
  const { data: stats } = useGeozoneStats();

  return (
    <div className='space-y-6 p-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('title')}</h1>
          <p className='text-sm text-muted-foreground'>{t('subtitle')}</p>
        </div>
        <CreateGeozoneDialog />
      </div>

      {/* Stats */}
      {stats && (
        <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
          <Card>
            <CardContent className='flex items-center gap-3 p-4'>
              <div className='rounded-md bg-primary/10 p-2'>
                <MapPin className='size-5 text-primary' />
              </div>
              <div>
                <p className='text-2xl font-semibold'>{stats.totalZones}</p>
                <p className='text-xs text-muted-foreground'>{t('totalZones')}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='flex items-center gap-3 p-4'>
              <div className='rounded-md bg-green-500/10 p-2'>
                <MapPin className='size-5 text-green-600' />
              </div>
              <div>
                <p className='text-2xl font-semibold'>{stats.activeZones}</p>
                <p className='text-xs text-muted-foreground'>{t('activeZones')}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className='flex items-center gap-3 p-4'>
              <div className='rounded-md bg-blue-500/10 p-2'>
                <Building2 className='size-5 text-blue-600' />
              </div>
              <div>
                <p className='text-2xl font-semibold'>
                  {stats.zones.reduce((s, z) => s + z.establishmentCount, 0)}
                </p>
                <p className='text-xs text-muted-foreground'>{t('totalEstablishments')}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className='flex items-center gap-2'>
        <Input
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className='h-9 max-w-[220px] text-sm'
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className='h-9 w-[150px] text-sm'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('allStatuses')}</SelectItem>
            <SelectItem value='active'>{t('status.active')}</SelectItem>
            <SelectItem value='inactive'>{t('status.inactive')}</SelectItem>
            <SelectItem value='coming_soon'>{t('status.comingSoon')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Zone list */}
      {isLoading ? (
        <GeozoneSkeleton />
      ) : !zones || zones.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-16 gap-3 text-center'>
          <MapPin className='size-12 text-muted-foreground' />
          <h3 className='text-md font-semibold'>{t('noZones')}</h3>
          <p className='text-sm text-muted-foreground max-w-xs'>{t('noZonesDesc')}</p>
        </div>
      ) : (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {zones.map(zone => (
            <GeozoneCard key={zone._id} zone={zone} />
          ))}
        </div>
      )}
    </div>
  );
}

function GeozoneCard({ zone }: { zone: GeozoneRow }) {
  const t = useTranslations('adminGeozones');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const update = useUpdateGeozone();
  const remove = useDeleteGeozone();

  const toggleStatus = () => {
    const newStatus: GeozoneStatus = zone.status === 'active' ? 'inactive' : 'active';
    update.mutate({ id: zone._id, payload: { status: newStatus } });
  };

  return (
    <>
      <Card>
        <CardContent className='p-4 space-y-3'>
          <div className='flex items-start justify-between'>
            <div>
              <h3 className='text-sm font-medium'>{zone.displayName}</h3>
              <p className='text-xs text-muted-foreground'>{zone.name}</p>
            </div>
            <Badge className={`text-xs ${STATUS_COLORS[zone.status]}`}>
              {t(
                `status.${zone.status === 'coming_soon' ? 'comingSoon' : zone.status}` as Parameters<
                  typeof t
                >[0],
              )}
            </Badge>
          </div>
          {zone.description && (
            <p className='text-xs text-muted-foreground line-clamp-2'>{zone.description}</p>
          )}
          <div className='grid grid-cols-2 gap-2 text-xs'>
            <div>
              <span className='text-muted-foreground'>{t('searchRadius')}</span>
              <p className='font-medium'>{(zone.defaultSearchRadius / 1000).toFixed(1)} km</p>
            </div>
            <div>
              <span className='text-muted-foreground'>{t('establishments')}</span>
              <p className='font-medium'>{zone.establishmentCount}</p>
            </div>
          </div>
          <div className='flex justify-end gap-2'>
            <Button size='sm' variant='outline' onClick={toggleStatus}>
              {zone.status === 'active' ? t('deactivate') : t('activate')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' className='size-7'>
                  <MoreHorizontal className='size-3.5' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => setDeleteOpen(true)} className='text-destructive'>
                  <Trash2 className='size-4 me-2' />
                  {t('delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmDesc')}
        confirmLabel={t('delete')}
        variant='danger'
        isLoading={remove.isPending}
        onConfirm={() => {
          remove.mutate(zone._id, { onSuccess: () => setDeleteOpen(false) });
        }}
      />
    </>
  );
}

function CreateGeozoneDialog() {
  const t = useTranslations('adminGeozones');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const create = useCreateGeozone();

  const handleSubmit = () => {
    const payload: CreateGeozonePayload = {
      name,
      displayName,
      center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
      polygonCoordinates: [],
    };
    create.mutate(payload, {
      onSuccess: () => {
        setOpen(false);
        setName('');
        setDisplayName('');
        setLat('');
        setLng('');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm'>
          <Plus className='size-3.5 me-1.5' />
          {t('create')}
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('createDialog.title')}</DialogTitle>
          <DialogDescription>{t('createDialog.desc')}</DialogDescription>
        </DialogHeader>
        <div className='space-y-3 py-2'>
          <div className='space-y-1'>
            <Label className='text-xs'>{t('createDialog.name')}</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='tunis-center'
              className='h-9 text-sm'
            />
          </div>
          <div className='space-y-1'>
            <Label className='text-xs'>{t('createDialog.displayName')}</Label>
            <Input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder='Tunis Centre'
              className='h-9 text-sm'
            />
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1'>
              <Label className='text-xs'>{t('createDialog.latitude')}</Label>
              <Input
                type='number'
                step='any'
                value={lat}
                onChange={e => setLat(e.target.value)}
                className='h-9 text-sm'
              />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>{t('createDialog.longitude')}</Label>
              <Input
                type='number'
                step='any'
                value={lng}
                onChange={e => setLng(e.target.value)}
                className='h-9 text-sm'
              />
            </div>
          </div>
          <Button
            size='sm'
            className='w-full'
            onClick={handleSubmit}
            disabled={!name || !displayName || !lat || !lng || create.isPending}
          >
            {t('createDialog.submit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GeozoneSkeleton() {
  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className='p-4 space-y-3'>
            <Skeleton className='h-5 w-32' />
            <Skeleton className='h-4 w-full' />
            <Skeleton className='h-4 w-20' />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
