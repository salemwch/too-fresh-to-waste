'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationService } from '@/services/organization.service';
import type { OrganizationResponse, InvitationResponse } from '@/services/organization.service';

// ─── Query keys (central, predictable) ─────────────────────────────────────

export const organizationKeys = {
  all: ['organization'] as const,
  mine: () => [...organizationKeys.all, 'mine'] as const,
  invitations: (orgId: string) => [...organizationKeys.all, 'invitations', orgId] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * The organization the authenticated merchant belongs to (or owns).
 * Backend: GET /organizations/my-organization
 * Returns null if the merchant has no organization yet.
 */
export function useMyOrganization() {
  return useQuery({
    queryKey: organizationKeys.mine(),
    queryFn: async (): Promise<OrganizationResponse | null> => {
      const response = await organizationService.getMyOrganization();
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Create a new organization (owner only).
 * Backend: POST /organizations
 * Invalidates: mine
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; establishmentId: string }) =>
      organizationService.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationKeys.mine() });
    },
  });
}

/**
 * Update organization name (owner only).
 * Backend: PATCH /organizations/:id
 * Invalidates: mine
 */
export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string } }) =>
      organizationService.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationKeys.mine() });
    },
  });
}

/**
 * Invite a member to the organization by email.
 * Backend: POST /organizations/:orgId/invitations
 * Invalidates: invitations for this org
 */
export function useInviteMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; assignedEstablishmentId: string }) =>
      organizationService.invite(orgId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationKeys.invitations(orgId) });
    },
  });
}

/**
 * List all pending/sent invitations for an organization.
 * Backend: GET /organizations/:orgId/invitations
 * Only enabled when orgId is non-empty.
 */
export function useOrganizationInvitations(orgId: string) {
  return useQuery({
    queryKey: organizationKeys.invitations(orgId),
    queryFn: async (): Promise<InvitationResponse[]> => {
      const response = await organizationService.listInvitations(orgId);
      return response.data.data;
    },
    enabled: !!orgId,
  });
}

/**
 * Revoke a pending invitation.
 * Backend: DELETE /organizations/invitations/:invitationId
 * Invalidates: invitations for this org
 */
export function useRevokeInvitation(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => organizationService.revokeInvitation(invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationKeys.invitations(orgId) });
    },
  });
}
