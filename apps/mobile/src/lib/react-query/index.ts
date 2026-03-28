/**
 * TanStack Query - Central Export
 * Mobile-optimized TanStack Query setup for React Native
 *
 * Usage:
 * ```tsx
 * import { QueryProvider, useQuery, useMutation } from '@/lib/react-query';
 * ```
 */

// Core exports
export { QueryProvider,  } from './QueryProvider';
;
;
;

// Custom hooks
export {
  useQueryWithFocus,
  
  
  
  
  
} from './hooks';

// Re-export commonly used TanStack Query hooks and utilities
;

/**
 * TanStack Query Setup Summary:
 *
 * ✅ QueryClient Configuration
 * - Mobile-optimized cache times (24h GC, 5min stale)
 * - Network-aware retry logic
 * - Exponential backoff
 * - Centralized error handling
 *
 * ✅ Platform Integration
 * - Online Manager with NetInfo
 * - Focus Manager with AppState
 * - Automatic refetch on reconnect
 * - Automatic refetch on app focus
 *
 * ✅ DevTools
 * - Built-in logging
 * - Debug utilities
 * - Cache inspection
 * - Development-only code
 *
 * ✅ Error Boundaries
 * - Query error boundary
 * - Customizable fallback UI
 * - Error logging and tracking
 *
 * ✅ Custom Hooks
 * - useQueryWithFocus (screen focus refetch)
 * - useMutationWithOptimistic (optimistic updates)
 * - useNetworkAwareQuery (network-aware caching)
 * - useInvalidateQueries (type-safe invalidation)
 * - usePrefetchQuery (prefetching)
 * - useQuerySubscription (background sync)
 *
 * Quick Start:
 *
 * 1. Wrap your app with QueryProvider:
 * ```tsx
 * import { QueryProvider } from '@/lib/react-query';
 *
 * function App() {
 *   return (
 *     <QueryProvider>
 *       <YourApp />
 *     </QueryProvider>
 *   );
 * }
 * ```
 *
 * 2. Use queries in your components:
 * ```tsx
 * import { useQuery } from '@/lib/react-query';
 *
 * function OffersScreen() {
 *   const { data, isLoading, error } = useQuery({
 *     queryKey: ['offers'],
 *     queryFn: () => fetchOffers(),
 *   });
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return <OffersList offers={data} />;
 * }
 * ```
 *
 * 3. Use mutations for data updates:
 * ```tsx
 * import { useMutation, useQueryClient } from '@/lib/react-query';
 *
 * function CreateOfferButton() {
 *   const queryClient = useQueryClient();
 *
 *   const mutation = useMutation({
 *     mutationFn: (offer) => createOffer(offer),
 *     onSuccess: () => {
 *       queryClient.invalidateQueries({ queryKey: ['offers'] });
 *     },
 *   });
 *
 *   return (
 *     <Button
 *       onPress={() => mutation.mutate(offerData)}
 *       loading={mutation.isPending}
 *     >
 *       Create Offer
 *     </Button>
 *   );
 * }
 * ```
 *
 * 4. Use screen focus refetch (React Navigation):
 * ```tsx
 * import { useQueryWithFocus } from '@/lib/react-query';
 *
 * function OrdersScreen() {
 *   const { data } = useQueryWithFocus(
 *     ['orders'],
 *     fetchOrders
 *   );
 *
 *   return <OrdersList orders={data} />;
 * }
 * ```
 *
 * Best Practices:
 *
 * - Use descriptive query keys: ['offers', 'list', { status: 'active' }]
 * - Invalidate queries after mutations
 * - Use optimistic updates for better UX
 * - Prefetch data for anticipated navigation
 * - Handle loading and error states
 * - Use suspense boundaries for complex loading states
 * - Monitor network state for mobile
 * - Keep cache times appropriate for your data freshness needs
 *
 * Documentation:
 * https://tanstack.com/query/latest/docs/framework/react/overview
 */
