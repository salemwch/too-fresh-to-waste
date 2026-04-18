import { useMutation, useQueryClient } from '@tanstack/react-query';

import { leaderboardService } from '../services/leaderboardService';

const LEADERBOARD_QUERY_KEY = ['loyalty', 'leaderboard'];
const LOYALTY_ACCOUNT_KEY = ['loyalty', 'account'];

export function useLeaderboardConsent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (showRealName: boolean) =>
      leaderboardService.updateLeaderboardConsent(showRealName),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LEADERBOARD_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: LOYALTY_ACCOUNT_KEY });
    },
  });
}
