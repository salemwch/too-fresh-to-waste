import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EstablishmentStatus, OrderStatus, UserRole } from '@foodwaste/shared';
import { Model, PipelineStage } from 'mongoose';

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
    const bagPipeline: PipelineStage[] = [
      { $match: { status: { $in: FULFILLED_STATUSES } } },
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
      .select(
        'name displayName status establishmentCount foundingTarget foundingSignedCount launchedAt',
      )
      .lean()
      .exec();

    // Two grouped reads rather than one per zone — the N+1 rule applies to a
    // list of six as much as to a list of six hundred.
    const [waitingByZone, rescued] = await Promise.all([
      this.waitlistService.countByZone(),
      this.rescuedBagsByZone(zones.map(z => z.name)),
    ]);

    const mapped: PublicZone[] = zones.map(zone => ({
      name: zone.name,
      displayName: zone.displayName,
      status: zone.status,
      partners: zone.establishmentCount ?? 0,
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
   * Bags rescued per zone, matched on the establishment's city.
   *
   * Orders carry no zone, so the join runs through the establishment. Returns
   * an empty map rather than throwing when no zone has any fulfilled orders.
   */
  private async rescuedBagsByZone(zoneNames: string[]): Promise<Map<string, number>> {
    if (zoneNames.length === 0) {
      return new Map();
    }

    const pipeline: PipelineStage[] = [
      { $match: { status: { $in: FULFILLED_STATUSES } } },
      {
        $lookup: {
          from: 'establishments',
          localField: 'establishmentId',
          foreignField: '_id',
          as: 'est',
          pipeline: [{ $project: { 'address.city': 1 } }],
        },
      },
      { $unwind: { path: '$est', preserveNullAndEmptyArrays: false } },
      { $unwind: '$items' },
      {
        $group: {
          _id: { $toLower: '$est.address.city' },
          bags: { $sum: '$items.quantity' },
        },
      },
    ];

    const rows = await this.orderModel
      .aggregate<{ _id: string | null; bags: number }>(pipeline)
      .exec();

    const byCity = new Map(rows.filter(r => r._id).map(r => [r._id as string, r.bags]));

    return new Map(zoneNames.map(name => [name, byCity.get(name.toLowerCase()) ?? 0] as const));
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
