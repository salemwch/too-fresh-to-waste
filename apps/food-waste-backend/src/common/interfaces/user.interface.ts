// Import enums from centralized location
import { UserRole, UserStatus } from '../enums/user.enum';

export interface IUser {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone?: string | undefined;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly emailVerified: boolean;
  readonly phoneVerified: boolean;
  readonly avatar?: string | undefined;
  readonly preferences: IUserPreferences;
  readonly address?: IUserAddress | undefined;
  readonly loyaltyPoints: number;
  readonly totalOrders: number;
  readonly totalSpent: number;
  readonly averageRating?: number | undefined;
  readonly lastLoginAt?: Date | undefined;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface IUserPreferences {
  readonly notifications: INotificationPreferences;
  readonly dietary: IDietaryPreferences;
  readonly delivery: IDeliveryPreferences;
  readonly language: string;
  readonly currency: string;
  readonly timezone: string;
}

export interface INotificationPreferences {
  readonly email: boolean;
  readonly push: boolean;
  readonly sms: boolean;
  readonly marketing: boolean;
  readonly orderUpdates: boolean;
  readonly newOffers: boolean;
}

export interface IDietaryPreferences {
  readonly vegetarian: boolean;
  readonly vegan: boolean;
  readonly glutenFree: boolean;
  readonly halal: boolean;
  readonly kosher: boolean;
  readonly allergies: string[];
}

export interface IDeliveryPreferences {
  readonly defaultAddress?: string | undefined;
  readonly preferredTimeSlots: string[];
  readonly instructions?: string | undefined;
}

export interface IUserAddress {
  readonly street: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
  readonly isDefault: boolean;
  readonly coordinates?:
    | {
        readonly latitude: number;
        readonly longitude: number;
      }
    | undefined;
}

// UserRole and UserStatus enums are now imported from '../enums/user.enum'
// and re-exported for backward compatibility
export { UserRole, UserStatus };

export interface IUserStats {
  readonly totalUsers: number;
  readonly activeUsers: number;
  readonly newUsersToday: number;
  readonly newUsersThisWeek: number;
  readonly newUsersThisMonth: number;
  readonly averageOrdersPerUser: number;
  readonly topSpenders: ITopSpender[];
}

export interface ITopSpender {
  readonly userId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly totalSpent: number;
  readonly totalOrders: number;
}

export interface IUserListResponse {
  readonly users: IUser[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}
