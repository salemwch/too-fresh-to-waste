import { apiClient } from '@/lib/api-client';
import type { BackendEnvelope } from '@/types/dashboard';

export interface OrganizationResponse {
  _id: string;
  name: string;
  logo?: string;
  ownerId: string;
  status: string;
  establishmentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InvitationResponse {
  _id: string;
  organizationId: string;
  email: string;
  role: string;
  assignedEstablishmentId: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface InvitationVerifyResponse {
  email: string;
  organizationName: string;
  establishmentName: string;
  expiresAt: string;
}

const BASE = '/organizations';

export const organizationService = {
  getMyOrganization() {
    return apiClient.get<BackendEnvelope<OrganizationResponse | null>>(`${BASE}/my-organization`);
  },

  create(data: { name: string; establishmentId: string }) {
    return apiClient.post<BackendEnvelope<OrganizationResponse>>(
      BASE,
      { name: data.name },
      { params: { establishmentId: data.establishmentId } },
    );
  },

  update(id: string, data: { name?: string }) {
    return apiClient.patch<BackendEnvelope<OrganizationResponse>>(`${BASE}/${id}`, data);
  },

  addEstablishment(orgId: string, establishmentId: string) {
    return apiClient.post<BackendEnvelope<OrganizationResponse>>(
      `${BASE}/${orgId}/establishments/${establishmentId}`,
    );
  },

  removeEstablishment(orgId: string, establishmentId: string) {
    return apiClient.delete<BackendEnvelope<OrganizationResponse>>(
      `${BASE}/${orgId}/establishments/${establishmentId}`,
    );
  },

  invite(orgId: string, data: { email: string; assignedEstablishmentId: string }) {
    return apiClient.post<BackendEnvelope<InvitationResponse>>(
      `${BASE}/${orgId}/invitations`,
      data,
    );
  },

  listInvitations(orgId: string) {
    return apiClient.get<BackendEnvelope<InvitationResponse[]>>(`${BASE}/${orgId}/invitations`);
  },

  revokeInvitation(invitationId: string) {
    return apiClient.delete<BackendEnvelope<void>>(`${BASE}/invitations/${invitationId}`);
  },

  verifyInvitation(token: string) {
    return apiClient.get<BackendEnvelope<InvitationVerifyResponse>>(
      `${BASE}/invitations/verify/${token}`,
    );
  },

  acceptInvitation(data: {
    token: string;
    firstName: string;
    lastName: string;
    password: string;
    phoneNumber?: string;
  }) {
    return apiClient.post<BackendEnvelope<{ userId: string; organizationId: string }>>(
      `${BASE}/invitations/accept`,
      data,
    );
  },

  /**
   * POST /establishments
   * Create a new establishment for an organization owner.
   * Called before addEstablishment() to get the new establishment's _id.
   */
  createEstablishment(data: {
    name: string;
    description: string;
    type: string;
    address: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
      coordinates: { type: string; coordinates: [number, number] };
    };
    phoneNumber: string;
    email: string;
    googlePlaceId?: string;
  }) {
    return apiClient.post<BackendEnvelope<{ _id: string }>>('/establishments', data);
  },
};
