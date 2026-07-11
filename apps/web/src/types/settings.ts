export interface UserProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  avatar?: string;
  profileImage?: string;
  role: string;
  authProvider: 'local' | 'google' | 'facebook' | 'apple';
  isEmailVerified: boolean;
  isPhoneVerified?: boolean;
  isActive: boolean;
  address?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ActiveSession {
  sessionId: string;
  deviceInfo?: string;
  ipAddress?: string;
  lastActive: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface MfaStatus {
  enabled: boolean;
  method?: string;
}
