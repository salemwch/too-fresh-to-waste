/** Shapes returned by the unauthenticated `/public/*` endpoints. */

type ZoneStatus = 'active' | 'coming_soon' | 'inactive';

export interface PublicZone {
  /** Geozone name — the key the waiting-list form posts back. */
  name: string;
  displayName: string;
  status: ZoneStatus;
  partners: number;
  bagsRescued: number;
  peopleWaiting: number;
  /** `0` when the zone runs no unlock campaign, so no meter is drawn. */
  foundingTarget: number;
  foundingSigned: number;
  launchedAt: string | null;
}

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

type WaitlistAudience = 'consumer' | 'merchant';

export interface JoinWaitlistPayload {
  email: string;
  zone: string;
  audience?: WaitlistAudience;
}
