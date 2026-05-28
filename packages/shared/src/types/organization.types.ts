import type { OrganizationStatus, OrganizationRole, InvitationStatus } from '../enums';

export interface OrganizationType {
  _id: string;
  name: string;
  logo?: string;
  ownerId: string;
  status: OrganizationStatus;
  establishmentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: OrganizationRole;
  assignedEstablishmentId?: string;
  assignedEstablishmentName?: string;
  joinedAt: string;
}

export interface OrganizationInvitation {
  _id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  assignedEstablishmentId: string;
  status: InvitationStatus;
  invitedBy: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}
