/**
 * Home Screen Hooks - Barrel Export
 * Centralized export point for all home screen custom hooks
 */

export { useHomeFilters } from './useHomeFilters';
export { useHomeOffers } from './useHomeOffers';
export { useLocationSetup } from './useLocationSetup';
export { useCommunityBagGoal, COMMUNITY_GOAL_QUERY_KEY } from './useCommunityBagGoal';

export type { UseHomeFiltersResult } from './useHomeFilters';
export type { UseHomeOffersResult, Coordinates, OffersLoadingState, OffersErrorState, OffersRefetchFunctions } from './useHomeOffers';
export type { UseLocationSetupResult } from './useLocationSetup';
