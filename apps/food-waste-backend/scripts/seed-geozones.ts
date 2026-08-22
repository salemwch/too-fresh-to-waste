/**
 * Seed the launch geozones that the public rollout map reads.
 *
 * The map renders nothing until zones exist, because it will not invent a city
 * we cannot confirm. This creates the two we have committed to: Sousse live and
 * Monastir unlocking next. Further cities are one entry each in ZONES below,
 * with status COMING_SOON and foundingTarget 0 — they then rank themselves by
 * how many people are waiting.
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

import { redactDatabaseUrl, resolveDatabaseUrl } from './lib/schema-registry';

dotenv.config();

interface ZoneSeed {
  name: string;
  displayName: string;
  status: GeozoneStatus;
  center: { latitude: number; longitude: number };
  /** Founding businesses needed to open. `0` means no unlock campaign. */
  foundingTarget: number;
  launchedAt?: Date;
}

/**
 * A square around the city centre, closed and wound correctly.
 *
 * Placeholder catchments, not municipal boundaries: the map only asks whether a
 * zone exists and what state it is in. Replace with real polygons before
 * anything routes deliveries by them — the 2dsphere index will reject a
 * malformed ring at write time, which is the check that matters here.
 */
const box = (lat: number, lng: number, half = 0.09) => ({
  type: 'Polygon' as const,
  coordinates: [
    [
      [lng - half, lat - half],
      [lng + half, lat - half],
      [lng + half, lat + half],
      [lng - half, lat + half],
      [lng - half, lat - half],
    ],
  ],
});

const ZONES: ZoneSeed[] = [
  {
    name: 'Sousse',
    displayName: 'Sousse',
    status: GeozoneStatus.ACTIVE,
    center: { latitude: 35.8256, longitude: 10.6084 },
    foundingTarget: 0,
    launchedAt: new Date('2026-03-01T00:00:00.000Z'),
  },
  {
    name: 'Monastir',
    displayName: 'Monastir',
    status: GeozoneStatus.COMING_SOON,
    center: { latitude: 35.7643, longitude: 10.8113 },
    foundingTarget: 50,
  },
];

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const url = resolveDatabaseUrl();

  console.log(`\ngeozone seed — ${redactDatabaseUrl(url)}`);
  console.log(apply ? 'mode: APPLY\n' : 'mode: dry run (pass --apply to make changes)\n');

  const connection = await mongoose.createConnection(url).asPromise();
  const Geozone = connection.model('Geozone', GeozoneSchema);

  try {
    for (const zone of ZONES) {
      const existing = await Geozone.findOne({ name: zone.name }).lean().exec();

      if (!existing) {
        console.log(`CREATE  ${zone.displayName.padEnd(10)} ${zone.status}`);
        if (apply) {
          await Geozone.create({
            ...zone,
            boundary: box(zone.center.latitude, zone.center.longitude),
          });
        }
        continue;
      }

      // Never walk a live city backwards. Status is an operational decision an
      // admin makes in the dashboard, and re-running a seed must not undo it.
      const wouldDemote =
        existing.status === GeozoneStatus.ACTIVE && zone.status !== GeozoneStatus.ACTIVE;

      const update: Record<string, unknown> = { foundingTarget: zone.foundingTarget };
      if (!wouldDemote) {update['status'] = zone.status;}
      if (zone.launchedAt && !existing.launchedAt) {update['launchedAt'] = zone.launchedAt;}

      console.log(
        `UPDATE  ${zone.displayName.padEnd(10)} ${Object.keys(update).join(', ')}${ 
          wouldDemote ? '  (status left as active)' : ''}`,
      );
      if (apply) {await Geozone.updateOne({ _id: existing._id }, { $set: update }).exec();}
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
