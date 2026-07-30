import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { environment } from '@/config/environment';
import { Freshness } from '@/lib/react-query/freshness';

/**
 * Server-controlled switches for features that are already shipped in the
 * binary.
 *
 * The point is release latency. Anything gated behind a compile-time constant
 * or a `react-native-config` value needs a new AAB and a Play review to change
 * — days. Anything gated here changes with a backend restart — minutes. Use
 * this for any feature that might have to be turned off in a hurry.
 */
export interface FeatureFlags {
  /** Konnect card payment at checkout. Cash on pickup/delivery is unaffected. */
  onlinePayment: boolean;
}

/**
 * What we assume before the first response lands, and whenever the request
 * fails.
 *
 * `false` for anything that takes money. A flag we could not read is not a
 * reason to offer a payment path we cannot verify is working — and defaulting
 * to `false` also means the button never flashes in and back out on a cold
 * start with a slow connection.
 */
const FALLBACK: FeatureFlags = {
  onlinePayment: false,
};

export const featureFlagKeys = {
  all: ['config', 'features'] as const,
};

export function useFeatureFlags(): FeatureFlags {
  const { data } = useQuery({
    queryKey: featureFlagKeys.all,
    queryFn: async (): Promise<FeatureFlags> => {
      const response = await axios.get<{ data: FeatureFlags }>(
        `${environment.api.baseUrl}/config/features`,
        { timeout: 5000 },
      );
      return response.data.data;
    },
    // STANDARD, not STATIC: this doubles as a kill switch, and a 30-minute tier
    // would mean half an hour of a broken payment path still being offered.
    staleTime: Freshness.STANDARD,
    retry: 1,
  });

  return data ?? FALLBACK;
}
