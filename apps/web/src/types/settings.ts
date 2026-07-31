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

/**
 * A session as `GET /auth/sessions` actually returns it.
 *
 * This used to declare `lastActive`, `isCurrent` and a string `deviceInfo` —
 * none of which the endpoint sends. `new Date(undefined).toLocaleDateString()`
 * threw `RangeError: Invalid time value` and took the whole settings page down
 * the moment a merchant opened the Sessions tab.
 *
 * Every field here is optional except the id: this is a hand-written mirror of a
 * response shape, and the last version of it was wrong in four places at once.
 * Optional costs a guard at the call site; wrong costs the page.
 */
export interface SessionDeviceInfo {
  deviceName?: string;
  platform?: string;
  browser?: string;
  ipAddress?: string;
  isTrusted?: boolean;
}

export interface ActiveSession {
  sessionId: string;
  deviceInfo?: SessionDeviceInfo;
  createdAt?: string;
  lastActivityAt?: string;
  expiresAt?: string;
  isCurrentSession?: boolean;
}

/**
 * The endpoint returns `{ success, sessions }` with no `data` key, so the
 * response interceptor treats that whole object as the payload — the array is at
 * `response.data.data.sessions`, not `response.data.data`.
 */
export interface ActiveSessionsResponse {
  success?: boolean;
  sessions?: ActiveSession[];
}

export interface MfaStatus {
  enabled: boolean;
  method?: string;
}
