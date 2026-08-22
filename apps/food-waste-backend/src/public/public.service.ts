import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EstablishmentStatus, OrderStatus, UserRole } from '@foodwaste/shared';
import { Model, PipelineStage, Types } from 'mongoose';

import { Geozone, GeozoneDocument, GeozoneStatus } from '../admin/schemas/geozone.schema';
import { BAG_IMPACT } from '../analytics/constants/sustainability.constants';
import { CacheService } from '../common/services/cache.service';
import {
  Establishment,
  EstablishmentDocument,
} from '../establishments/schemas/establishment.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

import { WaitlistAudience } from '../waitlist/schemas/waitlist-entry.schema';
import { WaitlistService } from '../waitlist/waitlist.service';

/** Orders where the food actually reached a person. Nothing else is "rescued". */
const FULFILLED_STATUSES = [OrderStatus.PICKED_UP, OrderStatus.DELIVERED, OrderStatus.COMPLETED];

export interface PublicImpact {
  bagsRescued: number;
  mealsRescued: number;
  partners: number;
  carbonAvoidedKg: number;
  people: number;
  citiesLive: number;
  peopleWaiting: number;
  generatedAt: string;
}

export interface PublicZone {
  name: string;
  displayName: string;
  status: GeozoneStatus;
  partners: number;
  bagsRescued: number;
  peopleWaiting: number;
  foundingTarget: number;
  foundingSigned: number;
  launchedAt: string | null;
}

@Injectable()
export class PublicService {
  /**
   * These figures sit on the marketing homepage, so they are read far more
   * often than they change and they are identical for every visitor. Cached as
   * one shared entry — never keyed by viewer, per the caching rule in CLAUDE.md.
   */
  private static readonly IMPACT_CACHE_KEY = 'public:impact:v1';
  private static readonly ZONES_CACHE_KEY = 'public:zones:v1';
  private static readonly CACHE_TTL_SECONDS = 300;

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Geozone.name) private readonly geozoneModel: Model<GeozoneDocument>,
    private readonly cacheService: CacheService,
    private readonly waitlistService: WaitlistService,
  ) {}

  async getImpact(): Promise<PublicImpact> {
    const impact = await this.cacheService.getOrSet(
      PublicService.IMPACT_CACHE_KEY,
      this.computeImpact.bind(this),
      PublicService.CACHE_TTL_SECONDS,
    );
    return impact;
  }

  private async computeImpact(): Promise<PublicImpact> {
    /**
     * Rescued bags, excluding orders whose establishment has been deleted.
     *
     * Without the join this counted every fulfilled order ever written, and on
     * live data 47 of 141 orders pointed at establishments that no longer
     * exist — 868 of 1550 bags, 56% of the headline figure, left behind by
     * merchant records being cleaned up. A public number that is more than half
     * orphaned rows is not a number worth publishing.
     *
     * Deliberately "still exists" rather than "is active": a merchant suspended
     * this week did not un-rescue food they sold last month, and tying the
     * figure to `status` would make it move every time an account is paused.
     */
    const bagPipeline: PipelineStage[] = [
      { $match: { status: { $in: FULFILLED_STATUSES } } },
      {
        $lookup: {
          from: 'establishments',
          localField: 'establishmentId',
          foreignField: '_id',
          as: 'est',
          pipeline: [{ $project: { _id: 1 } }],
        },
      },
      { $match: { est: { $ne: [] } } },
      { $unwind: '$items' },
      { $group: { _id: null, bags: { $sum: '$items.quantity' } } },
    ];

    const [bagResult, partners, people, citiesLive, peopleWaiting] = await Promise.all([
      this.orderModel.aggregate(bagPipeline).exec(),
      this.establishmentModel.countDocuments({ status: EstablishmentStatus.ACTIVE }).exec(),
      this.userModel.countDocuments({ role: UserRole.CONSUMER }).exec(),
      this.geozoneModel.countDocuments({ status: GeozoneStatus.ACTIVE }).exec(),
      this.waitlistService.totalWaiting(),
    ]);

    const bagsRescued = (bagResult[0] as { bags: number } | undefined)?.bags ?? 0;

    // Derived from the bag count with the ADEME coefficients already used by the
    // merchant carbon report, so the public figure and the PDF cannot disagree.
    const foodKg = bagsRescued * BAG_IMPACT.avgKgPerBag;

    return {
      bagsRescued,
      mealsRescued: Math.round(foodKg * BAG_IMPACT.mealsPerKg),
      partners,
      carbonAvoidedKg: Math.round(foodKg * BAG_IMPACT.carbonPerKg),
      people,
      citiesLive,
      peopleWaiting,
      generatedAt: new Date().toISOString(),
    };
  }

  async getZones(): Promise<PublicZone[]> {
    const zones = await this.cacheService.getOrSet(
      PublicService.ZONES_CACHE_KEY,
      this.computeZones.bind(this),
      PublicService.CACHE_TTL_SECONDS,
    );
    return zones;
  }

  /**
   * The rollout map, ordered the way the section reads it.
   *
   * Admin pins only two things — which zone is live and which one is unlocking
   * next. Everything still queued is ranked by how many people are waiting for
   * it, so the public order moves on its own as sign-ups land. That is the
   * whole mechanic: a single sign-up can reorder the page.
   */
  private async computeZones(): Promise<PublicZone[]> {
    const zones = await this.geozoneModel
      .find({ status: { $ne: GeozoneStatus.INACTIVE } })
      .select('name displayName status boundary foundingTarget foundingSignedCount launchedAt')
      .lean()
      .exec();

    const membership = await this.establishmentsByZone(zones);

    // Two grouped reads rather than one per zone — the N+1 rule applies to a
    // list of six as much as to a list of six hundred.
    const [waitingByZone, rescued] = await Promise.all([
      this.waitlistService.countByZone(),
      this.rescuedBagsByZone(membership),
    ]);

    const mapped: PublicZone[] = zones.map(zone => ({
      name: zone.name,
      displayName: zone.displayName,
      status: zone.status,
      // Counted from the establishments actually inside the zone, not from the
      // `establishmentCount` field on the geozone — nothing maintains that
      // counter, so it reads zero for every city that was not hand-edited.
      partners: membership.get(zone.name)?.length ?? 0,
      bagsRescued: rescued.get(zone.name) ?? 0,
      peopleWaiting: waitingByZone.get(zone.name) ?? 0,
      foundingTarget: zone.foundingTarget ?? 0,
      foundingSigned: zone.foundingSignedCount ?? 0,
      launchedAt: zone.launchedAt ? new Date(zone.launchedAt).toISOString() : null,
    }));

    const rank: Record<GeozoneStatus, number> = {
      [GeozoneStatus.ACTIVE]: 0,
      [GeozoneStatus.COMING_SOON]: 1,
      [GeozoneStatus.INACTIVE]: 2,
    };

    /**
     * A founding target is the unlock campaign, so the city carrying one is the
     * city opening next and must sort above the merely announced ones.
     *
     * Without this the announced cities were separated only by their waiting
     * counts, which are all zero on the day a rollout is published — so the
     * name tiebreaker decided, and the city actually opening next appeared
     * fourth while alphabetical luck took the panel.
     */
    const campaigning = (zone: PublicZone): number => (zone.foundingTarget > 0 ? 0 : 1);

    return mapped.sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        campaigning(a) - campaigning(b) ||
        b.peopleWaiting - a.peopleWaiting ||
        a.displayName.localeCompare(b.displayName),
    );
  }

  /**
   * Which establishments sit inside each zone.
   *
   * Attribution used to compare `address.city` to the zone name as lowercased
   * strings, which is wrong in every way a string can be: "Gabès" never matched
   * the zone "Gabes", a shop filed under "Sousse Ville" matched nothing, and an
   * Arabic or French spelling matched nothing either. On live data that stranded
   * roughly three quarters of the rescued bags outside every zone.
   *
   * A zone is a polygon and an establishment is a point, so membership is a
   * geometry question. MongoDB answers it with its own spherical geometry
   * against the 2dsphere index on `address.coordinates`; reimplementing
   * point-in-polygon here would be a second, subtly different answer to a
   * question the database already answers correctly.
   *
   * One indexed query per zone. Zones are a handful and the result is cached
   * for five minutes, so this is cheaper than the join it replaces.
   */
  private async establishmentsByZone(
    zones: Array<{ name: string; boundary?: { type: string; coordinates: number[][][] } }>,
  ): Promise<Map<string, string[]>> {
    const entries = await Promise.all(
      zones.map(async zone => {
        // A zone seeded without a polygon claims nobody rather than everybody.
        if (!zone.boundary) {
          return [zone.name, [] as string[]] as const;
        }

        const ids = await this.establishmentModel
          .distinct('_id', {
            status: EstablishmentStatus.ACTIVE,
            'address.coordinates': { $geoWithin: { $geometry: zone.boundary } },
          })
          .exec();

        return [zone.name, ids.map(id => String(id))] as const;
      }),
    );

    return new Map(entries);
  }

  /**
   * Bags rescued per zone.
   *
   * Orders carry no zone, so they are grouped by establishment and folded into
   * zones through the membership map. An establishment that belongs to no zone
   * contributes to none — which is why the per-zone figures can sum to less than
   * the platform total, and is the honest answer: we have not opened there.
   */
  private async rescuedBagsByZone(membership: Map<string, string[]>): Promise<Map<string, number>> {
    const zoneByEstablishment = new Map<string, string>();
    for (const [zone, ids] of membership) {
      for (const id of ids) {
        zoneByEstablishment.set(id, zone);
      }
    }

    if (zoneByEstablishment.size === 0) {
      return new Map();
    }

    const pipeline: PipelineStage[] = [
      {
        $match: {
          status: { $in: FULFILLED_STATUSES },
          establishmentId: {
            $in: [...zoneByEstablishment.keys()].map(id => new Types.ObjectId(id)),
          },
        },
      },
      { $unwind: '$items' },
      { $group: { _id: '$establishmentId', bags: { $sum: '$items.quantity' } } },
    ];

    const rows = await this.orderModel
      .aggregate<{ _id: Types.ObjectId; bags: number }>(pipeline)
      .exec();

    const byZone = new Map<string, number>();
    for (const row of rows) {
      const zone = zoneByEstablishment.get(String(row._id));
      if (!zone) {
        continue;
      }
      byZone.set(zone, (byZone.get(zone) ?? 0) + row.bags);
    }

    return byZone;
  }

  /**
   * Adds someone to a city's waiting list.
   *
   * Signing up twice is the normal case — a shared link gets clicked again — so
   * the duplicate key is treated as success. Telling a visitor "you are already
   * on this list" leaks that the address is registered and gives them nothing
   * to act on.
   */
  async joinWaitlist(email: string, zone: string, audience: WaitlistAudience): Promise<void> {
    await this.waitlistService.joinCity(email, zone, audience);

    // The queue is ranked by these counts, so a stale page would show the wrong
    // order to the next visitor.
    await this.cacheService.del(PublicService.ZONES_CACHE_KEY);
  }
}
