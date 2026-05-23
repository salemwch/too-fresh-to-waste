import { useMutation, useQueryClient } from '@tanstack/react-query';

import { leaderboardService } from '../services/leaderboardService';

const LEADERBOARD_QUERY_KEY = ['loyalty', 'leaderboard'];
const LOYALTY_ACCOUNT_KEY = ['loyalty', 'account'];

export function useLeaderboardConsent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (showRealName: boolean) =>
      leaderboardService.updateLeaderboardConsent(showRealName),
    onMutate: async (showRealName: boolean) => {
      await queryClient.cancelQueries({ queryKey: LOYALTY_ACCOUNT_KEY });
      const previous = queryClient.getQueryData(LOYALTY_ACCOUNT_KEY);

      queryClient.setQueryData(LOYALTY_ACCOUNT_KEY, (old: Record<string, unknown> | undefined) => {
        if (!old) return old;
        return {
          ...old,
          leaderboardConsent: {
            ...(old['leaderboardConsent'] as Record<string, unknown> | undefined),
            given: true,
            showRealName,
          },
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(LOYALTY_ACCOUNT_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: LEADERBOARD_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: LOYALTY_ACCOUNT_KEY });
    },
  });
}
