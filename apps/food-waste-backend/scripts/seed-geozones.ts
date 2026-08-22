/**
 * Seed the launch geozones that the public rollout map reads.
 *
 * The map renders nothing until zones exist, because it will not invent a city
 * we cannot confirm. This creates the whole announced rollout: Sousse live,
 * Monastir unlocking next, and Mahdia, Nabeul, Tunis and Gabès announced. Only
 * the first two are pinned — the rest carry no founding target and the public
 * map ranks them by how many people are waiting, so their order is demand.
 *
 *   pnpm --filter @foodwaste/backend seed:geozones
 *   pnpm --filter @foodwaste/backend seed:geozones --apply
 *
 * Idempotent: matched on `name`, existing zones are updated rather than
 * duplicated, and a zone that has already been launched is never demoted.
 * Without `--apply` it reports what it would do and changes nothing.
 */

import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

import { GeozoneSchema, GeozoneStatus } from '../src/admin/schemas/geozone.schema';
import { haversineKm } from '../src/common/utils/geo.util';

import { redactDatabaseUrl, resolveDatabaseUrl } from './lib/schema-registry';

dotenv.config();

interface ZoneSeed {
  name: string;
  displayName: string;
  status: GeozoneStatus;
  center: { latitude: number; longitude: number };
  /** Service catchment radius in kilometres. */
  radiusKm: number;
  /** Founding businesses needed to open. `0` means no unlock campaign. */
  foundingTarget: number;
  launchedAt?: Date;
}

const EARTH_RADIUS_KM = 6371;
const RING_POINTS = 64;

/**
 * A circular service catchment around the city centre, as a closed GeoJSON ring.
 *
 * Deliberately a catchment rather than a municipal boundary. This is a pickup
 * marketplace: what matters is whether a customer is close enough to collect a
 * bag before the shop shuts, which is a distance from the centre, not an
 * administrative border. Inventing precise borders would also mean inventing
 * data — a circle states plainly what it is.
 *
 * Longitude degrees shrink with latitude, so the east–west offset is divided by
 * cos(lat); without that the ring is an ellipse and the eastern edge reaches
 * about 20% further than the radius claims at Tunisian latitudes. Points run
 * anticlockwise, which is the winding MongoDB expects for an exterior ring.
 */
const catchment = (lat: number, lng: number, radiusKm: number) => {
  const latDelta = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  const lngDelta = latDelta / Math.cos((lat * Math.PI) / 180);

  const ring = Array.from({ length: RING_POINTS }, (_, i) => {
    const angle = (2 * Math.PI * i) / RING_POINTS;
    return [
      Number((lng + lngDelta * Math.cos(angle)).toFixed(6)),
      Number((lat + latDelta * Math.sin(angle)).toFixed(6)),
    ];
  });

  // GeoJSON requires the first position repeated as the last one.
  ring.push([...ring[0]!]);

  return { type: 'Polygon' as const, coordinates: [ring] };
};

/**
 * The rollout, in the order it was committed to publicly.
 *
 * Only the live city and the one unlocking next are pinned here — everything
 * else is announced, and the public map ranks it by how many people are
 * waiting. Radii are sized so neighbouring catchments do not overlap, which
 * `assertNoOverlap` below enforces rather than trusts.
 */
const ZONES: ZoneSeed[] = [
  {
    name: 'Sousse',
    displayName: 'Sousse',
    status: GeozoneStatus.ACTIVE,
    center: { latitude: 35.8256, longitude: 10.6084 },
    radiusKm: 10,
    foundingTarget: 0,
    launchedAt: new Date('2026-03-01T00:00:00.000Z'),
  },
  {
    name: 'Monastir',
    displayName: 'Monastir',
    status: GeozoneStatus.COMING_SOON,
    center: { latitude: 35.7643, longitude: 10.8113 },
    radiusKm: 8,
    foundingTarget: 50,
  },
  {
    name: 'Mahdia',
    displayName: 'Mahdia',
    status: GeozoneStatus.COMING_SOON,
    center: { latitude: 35.5047, longitude: 11.0622 },
    radiusKm: 8,
    foundingTarget: 0,
  },
  {
    name: 'Nabeul',
    displayName: 'Nabeul',
    status: GeozoneStatus.COMING_SOON,
    center: { latitude: 36.456, longitude: 10.7376 },
    radiusKm: 9,
    foundingTarget: 0,
  },
  {
    name: 'Tunis',
    displayName: 'Tunis',
    status: GeozoneStatus.COMING_SOON,
    center: { latitude: 36.8065, longitude: 10.1815 },
    radiusKm: 15,
    foundingTarget: 0,
  },
  {
    name: 'Gabes',
    displayName: 'Gabès',
    status: GeozoneStatus.COMING_SOON,
    center: { latitude: 33.8815, longitude: 10.0982 },
    radiusKm: 10,
    foundingTarget: 0,
  },
];

/**
 * Overlapping catchments make "which zone is this address in?" ambiguous, and
 * the lookup would silently answer with whichever document came back first.
 * Cheaper to refuse to seed than to debug later.
 */
function assertNoOverlap(zones: ZoneSeed[]): void {
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i]!;
      const b = zones[j]!;
      const gap =
        haversineKm(
          { lat: a.center.latitude, lng: a.center.longitude },
          { lat: b.center.latitude, lng: b.center.longitude },
        ) -
        (a.radiusKm + b.radiusKm);

      if (gap < 0) {
        throw new Error(
          `${a.displayName} and ${b.displayName} overlap by ${Math.abs(gap).toFixed(1)} km — ` +
            'reduce a radius before seeding.',
        );
      }
    }
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const url = resolveDatabaseUrl();

  console.log(`\ngeozone seed — ${redactDatabaseUrl(url)}`);
  console.log(apply ? 'mode: APPLY\n' : 'mode: dry run (pass --apply to make changes)\n');

  // Fail before opening a connection: a geometry problem is not a database
  // problem, and it should not be reported as one.
  assertNoOverlap(ZONES);

  const connection = await mongoose.createConnection(url).asPromise();
  const Geozone = connection.model('Geozone', GeozoneSchema);

  try {
    for (const zone of ZONES) {
      const existing = await Geozone.findOne({ name: zone.name }).lean().exec();

      if (!existing) {
        console.log(
          `CREATE  ${zone.displayName.padEnd(10)} ${zone.status.padEnd(12)} r=${zone.radiusKm}km`,
        );
        if (apply) {
          await Geozone.create({
            ...zone,
            boundary: catchment(zone.center.latitude, zone.center.longitude, zone.radiusKm),
            defaultSearchRadius: zone.radiusKm * 1000,
          });
        }
        continue;
      }

      // Never walk a live city backwards. Status is an operational decision an
      // admin makes in the dashboard, and re-running a seed must not undo it.
      const wouldDemote =
        existing.status === GeozoneStatus.ACTIVE && zone.status !== GeozoneStatus.ACTIVE;

      const update: Record<string, unknown> = {
        foundingTarget: zone.foundingTarget,
        // Re-derived every run: the ring is a function of centre and radius,
        // so an edited radius here must not leave a stale polygon behind.
        boundary: catchment(zone.center.latitude, zone.center.longitude, zone.radiusKm),
        defaultSearchRadius: zone.radiusKm * 1000,
      };
      if (!wouldDemote) {
        update['status'] = zone.status;
      }
      if (zone.launchedAt && !existing.launchedAt) {
        update['launchedAt'] = zone.launchedAt;
      }

      console.log(
        `UPDATE  ${zone.displayName.padEnd(10)} ${Object.keys(update).join(', ')}${
          wouldDemote ? '  (status left as active)' : ''
        }`,
      );
      if (apply) {
        await Geozone.updateOne({ _id: existing._id }, { $set: update }).exec();
      }
    }

    console.log(apply ? '\nDone.\n' : '\nDry run — nothing was changed.\n');
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error('\nSeed failed:', error);
  process.exit(1);
});
