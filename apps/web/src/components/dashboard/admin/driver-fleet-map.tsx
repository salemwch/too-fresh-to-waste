'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { GoogleMap, useJsApiLoader, MarkerF, PolylineF, InfoWindowF } from '@react-google-maps/api';
import { MapPinOff, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@foodwaste/ui';
import type { DriverActivity, LiveDriver } from '@/types/admin';

/**
 * Tunis. Only used as the initial centre when no driver has a position yet -
 * once markers exist the map fits their bounds instead.
 */
const DEFAULT_CENTRE = { lat: 36.8065, lng: 10.1815 } as const;
const DEFAULT_ZOOM = 12;

/**
 * Read once at module scope with a literal key.
 *
 * Next.js inlines `NEXT_PUBLIC_*` by textual substitution at build time; a
 * dynamic `process.env[name]` is not substituted and is undefined in the
 * browser. Same trap as `@/lib/app-store-links`.
 */
const MAPS_API_KEY = process.env['NEXT_PUBLIC_GOOGLE_MAPS_KEY'] ?? '';

/**
 * Hoisted out of the component because `useJsApiLoader` treats this array as
 * part of the loader identity. A fresh array literal each render makes it
 * believe the configuration changed and re-run the loader.
 */
const MAP_LIBRARIES: 'places'[] = [];

/**
 * Marker fill per activity.
 *
 * Deliberately not the muted/primary tokens: these are painted onto satellite
 * and street imagery rather than onto the app's background, so they need to
 * hold up against arbitrary colours underneath. Each is paired with a white
 * stroke below for the same reason.
 */
const ACTIVITY_COLOR: Record<DriverActivity, string> = {
  en_route: '#1E4448',
  idle: '#2E7D32',
  stale: '#F57C00',
  offline: '#78909C',
};

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' } as const;

interface DriverFleetMapProps {
  drivers: readonly LiveDriver[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (driverId: string | null) => void;
}

/** Drivers we can actually place. The rest are listed but never drawn. */
function withPosition(drivers: readonly LiveDriver[]) {
  return drivers.filter(
    (d): d is LiveDriver & { position: NonNullable<LiveDriver['position']> } => d.position !== null,
  );
}

export function DriverFleetMap({ drivers, isLoading, selectedId, onSelect }: DriverFleetMapProps) {
  const t = useTranslations('adminDrivers.map');

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'tftw-admin-fleet-map',
    googleMapsApiKey: MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  });

  const placed = useMemo(() => withPosition(drivers), [drivers]);
  const selected = useMemo(
    () => placed.find(d => d._id === selectedId) ?? null,
    [placed, selectedId],
  );

  /**
   * Frame every driver on first load.
   *
   * Only on load: refitting on each poll would yank the viewport out from
   * under an admin who had panned somewhere deliberately, every thirty
   * seconds.
   */
  const onLoad = useCallback(
    (instance: google.maps.Map) => {
      const points = withPosition(drivers);
      if (points.length === 0) return;

      const bounds = new google.maps.LatLngBounds();
      for (const d of points) bounds.extend({ lat: d.position.lat, lng: d.position.lng });

      if (points.length === 1) {
        // `fitBounds` on a single point zooms to maximum, which is useless.
        instance.setCenter(bounds.getCenter());
        instance.setZoom(DEFAULT_ZOOM);
      } else {
        instance.fitBounds(bounds, 64);
      }
    },
    [drivers],
  );

  if (!MAPS_API_KEY) {
    // A missing key renders Google's own grey "can't load" box with a console
    // error, which looks like the feature is broken. Say what is actually
    // wrong instead - this is an admin screen, the reader can act on it.
    return <EmptyMapState icon={AlertTriangle} title={t('noKeyTitle')} body={t('noKeyBody')} />;
  }

  if (loadError) {
    return (
      <EmptyMapState icon={AlertTriangle} title={t('loadErrorTitle')} body={t('loadErrorBody')} />
    );
  }

  if (!isLoaded || isLoading) {
    return <Skeleton className='size-full min-h-[420px] rounded-lg' />;
  }

  return (
    <div className='relative size-full min-h-[420px] overflow-hidden rounded-lg border border-border/60'>
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={DEFAULT_CENTRE}
        zoom={DEFAULT_ZOOM}
        onLoad={onLoad}
        // Clicking empty map clears the selection, which is what every mapping
        // UI does and what an admin will try after opening the wrong marker.
        onClick={() => onSelect(null)}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        }}
      >
        {placed.map(driver => (
          <MarkerF
            key={driver._id}
            position={{ lat: driver.position.lat, lng: driver.position.lng }}
            onClick={() => onSelect(driver._id)}
            title={`${driver.firstName} ${driver.lastName}`}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: ACTIVITY_COLOR[driver.activity],
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
              // The selected driver reads larger so it stays findable after
              // the side panel scrolls the list.
              scale: driver._id === selectedId ? 11 : 8,
            }}
            zIndex={driver._id === selectedId ? 10 : 1}
          />
        ))}

        {/*
          The selected driver's route: where the food is collected, where it is
          going, and a line joining the two through the driver. Drawn only for
          the selection - drawing every driver's route at once is unreadable
          past about four drivers.
        */}
        {selected?.assignment?.pickup && (
          <MarkerF
            position={{
              lat: selected.assignment.pickup.lat,
              lng: selected.assignment.pickup.lng,
            }}
            label={{ text: 'P', color: '#FFFFFF', fontSize: '11px', fontWeight: '700' }}
            title={selected.assignment.pickup.name ?? t('pickup')}
            zIndex={5}
          />
        )}
        {selected?.assignment?.destination && (
          <MarkerF
            position={{
              lat: selected.assignment.destination.lat,
              lng: selected.assignment.destination.lng,
            }}
            label={{ text: 'D', color: '#FFFFFF', fontSize: '11px', fontWeight: '700' }}
            title={selected.assignment.destination.city ?? t('destination')}
            zIndex={5}
          />
        )}
        {selected?.assignment && <RouteLine driver={selected} />}

        {selected && (
          <InfoWindowF
            position={{ lat: selected.position.lat, lng: selected.position.lng }}
            onCloseClick={() => onSelect(null)}
            options={{ pixelOffset: new google.maps.Size(0, -14) }}
          >
            <div className='min-w-[160px] text-xs'>
              <p className='font-semibold text-slate-900'>
                {selected.firstName} {selected.lastName}
              </p>
              <p className='text-slate-600'>{t(`activity.${selected.activity}`)}</p>
              {selected.assignment && (
                <p className='mt-1 font-mono text-slate-600'>{selected.assignment.orderNumber}</p>
              )}
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>

      {placed.length === 0 && (
        // The map still renders underneath; this only covers it when there is
        // nothing to look at, so an admin is not left guessing whether the map
        // failed or the fleet is simply offline.
        <div className='absolute inset-0 grid place-items-center bg-background/80 backdrop-blur-sm'>
          <EmptyMapState
            icon={MapPinOff}
            title={t('noPositionsTitle')}
            body={t('noPositionsBody')}
          />
        </div>
      )}

      <MapLegend />
    </div>
  );
}

/**
 * Pickup -> driver -> destination.
 *
 * The driver sits in the middle of the line rather than at one end, which is
 * what makes the direction of travel readable at a glance: before collection
 * the bend points back at the shop, after it the line straightens toward the
 * customer.
 */
function RouteLine({
  driver,
}: {
  driver: LiveDriver & { position: NonNullable<LiveDriver['position']> };
}) {
  const path = useMemo(() => {
    const points: google.maps.LatLngLiteral[] = [];
    const a = driver.assignment;
    if (a?.pickup) points.push({ lat: a.pickup.lat, lng: a.pickup.lng });
    points.push({ lat: driver.position.lat, lng: driver.position.lng });
    if (a?.destination) points.push({ lat: a.destination.lat, lng: a.destination.lng });
    return points;
  }, [driver]);

  // Two points is a line; one is nothing to draw.
  if (path.length < 2) return null;

  return (
    <PolylineF
      path={path}
      options={{
        strokeColor: ACTIVITY_COLOR.en_route,
        strokeOpacity: 0.7,
        strokeWeight: 3,
        geodesic: true,
      }}
    />
  );
}

function MapLegend() {
  const t = useTranslations('adminDrivers.map');
  const activities: DriverActivity[] = ['en_route', 'idle', 'stale', 'offline'];

  return (
    <div className='absolute bottom-md start-md flex flex-wrap gap-sm rounded-lg border border-border/60 bg-background/95 px-md py-sm shadow-sm backdrop-blur'>
      {activities.map(activity => (
        <span key={activity} className='flex items-center gap-xs text-xs text-muted-foreground'>
          <span
            aria-hidden='true'
            className='size-2.5 shrink-0 rounded-full ring-1 ring-white'
            style={{ backgroundColor: ACTIVITY_COLOR[activity] }}
          />
          {t(`activity.${activity}`)}
        </span>
      ))}
    </div>
  );
}

function EmptyMapState({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof MapPinOff;
  title: string;
  body: string;
}) {
  return (
    <div className='grid size-full min-h-[420px] place-items-center rounded-lg border border-border/60 bg-muted/20 p-2xl text-center'>
      <div className='flex max-w-sm flex-col items-center gap-md'>
        <Icon className='size-10 text-muted-foreground/40' aria-hidden='true' />
        <p className='text-sm font-medium text-foreground'>{title}</p>
        <p className='text-xs text-muted-foreground'>{body}</p>
      </div>
    </div>
  );
}
