import { apiClient } from '@/lib/api-client';
import type { BackendEnvelope } from '@/types/dashboard';
import type {
  VotingCycleRow,
  CreateCyclePayload,
  UpdateCyclePayload,
  CycleStatsData,
} from '@/types/voting';

const VOTING_ADMIN = '/voting/admin';

export const votingAdminService = {
  /**
   * GET /voting/admin/cycles?page=&limit=
   * Paginated list of voting cycles.
   */
  listCycles(page = 1, limit = 10) {
    return apiClient.get<BackendEnvelope<VotingCycleRow[]>>(`${VOTING_ADMIN}/cycles`, {
      params: { page, limit },
    });
  },

  /**
   * POST /voting/admin/cycles
   * Create a new voting cycle in DRAFT status.
   */
  createCycle(payload: CreateCyclePayload) {
    return apiClient.post<BackendEnvelope<VotingCycleRow>>(`${VOTING_ADMIN}/cycles`, payload);
  },

  /**
   * PATCH /voting/admin/cycles/:id
   * Update a DRAFT cycle's metadata or prizes.
   */
  updateCycle(id: string, payload: UpdateCyclePayload) {
    return apiClient.patch<BackendEnvelope<VotingCycleRow>>(
      `${VOTING_ADMIN}/cycles/${id}`,
      payload,
    );
  },

  /**
   * DELETE /voting/admin/cycles/:id
   * Delete a DRAFT cycle (only allowed while in DRAFT status).
   */
  deleteCycle(id: string) {
    return apiClient.delete<BackendEnvelope<void>>(`${VOTING_ADMIN}/cycles/${id}`);
  },

  /**
   * POST /voting/admin/cycles/:id/activate
   * Transition a DRAFT cycle to ACTIVE — opens the ballot.
   */
  activateCycle(id: string) {
    return apiClient.post<BackendEnvelope<VotingCycleRow>>(`${VOTING_ADMIN}/cycles/${id}/activate`);
  },

  /**
   * POST /voting/admin/cycles/:id/archive
   * Archive a completed or cancelled cycle.
   */
  archiveCycle(id: string) {
    return apiClient.post<BackendEnvelope<VotingCycleRow>>(`${VOTING_ADMIN}/cycles/${id}/archive`);
  },

  /**
   * POST /voting/admin/cycles/:id/tally
   * Manually trigger a winner tally for the cycle.
   */
  manualTally(id: string) {
    return apiClient.post<BackendEnvelope<VotingCycleRow>>(`${VOTING_ADMIN}/cycles/${id}/tally`);
  },

  /**
   * POST /voting/admin/cycles/:id/retry-snapshot
   * Re-run the eligibility snapshot for a cycle whose snapshot failed.
   */
  retrySnapshot(id: string) {
    return apiClient.post<BackendEnvelope<{ count: number }>>(
      `${VOTING_ADMIN}/cycles/${id}/retry-snapshot`,
    );
  },

  /**
   * GET /voting/admin/cycles/:id/stats
   * Live vote tallies and participation metrics for a cycle.
   */
  getCycleStats(id: string) {
    return apiClient.get<BackendEnvelope<CycleStatsData>>(`${VOTING_ADMIN}/cycles/${id}/stats`);
  },
};
