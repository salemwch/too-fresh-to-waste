import { UserRole, UserStatus } from '../interfaces/user.interface';

import type { IUser, IUserStats, IUserListResponse } from '../interfaces/user.interface';

interface UserLike {
  _id?: { toString(): string };
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: IUser['role'];
  status?: IUser['status'];
  emailVerified?: boolean;
  phoneVerified?: boolean;
  avatar?: string;
  profile?: { firstName?: string; lastName?: string; phone?: string; avatar?: string };
  preferences?: {
    notifications?: {
      email?: boolean;
      push?: boolean;
      sms?: boolean;
      marketing?: boolean;
      orderUpdates?: boolean;
      newOffers?: boolean;
    };
    dietary?: {
      vegetarian?: boolean;
      vegan?: boolean;
      glutenFree?: boolean;
      halal?: boolean;
      kosher?: boolean;
      allergies?: string[];
    };
    delivery?: { defaultAddress?: string; preferredTimeSlots?: string[]; instructions?: string };
    language?: string;
    currency?: string;
    timezone?: string;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    isDefault?: boolean;
    coordinates?: { latitude?: number; longitude?: number };
  };
  loyaltyPoints?: number;
  stats?: { totalOrders?: number; totalSpent?: number; averageRating?: number };
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SpenderRecord {
  userId?: string;
  _id?: { toString(): string };
  email?: string;
  firstName?: string;
  lastName?: string;
  totalSpent?: number;
  totalOrders?: number;
}

interface StatsLike {
  totalUsers?: number;
  activeUsers?: number;
  newUsersToday?: number;
  newUsersThisWeek?: number;
  newUsersThisMonth?: number;
  averageOrdersPerUser?: number;
  topSpenders?: SpenderRecord[];
}

interface ListResponseLike {
  users?: UserLike[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export class UserMapper {
  static toInterface(document: UserLike | null | undefined): IUser {
    if (document === null || document === undefined) {
      throw new Error('Document cannot be null or undefined');
    }

    return {
      id: document._id?.toString() ?? document.id ?? '',
      email: document.email ?? '',
      firstName: document.firstName ?? document.profile?.firstName ?? '',
      lastName: document.lastName ?? document.profile?.lastName ?? '',
      phone: document.phone ?? document.profile?.phone,
      role: document.role ?? UserRole.CONSUMER,
      status: document.status ?? UserStatus.ACTIVE,
      emailVerified: document.emailVerified ?? false,
      phoneVerified: document.phoneVerified ?? false,
      avatar: document.avatar ?? document.profile?.avatar,
      preferences: {
        notifications: {
          email: document.preferences?.notifications?.email ?? true,
          push: document.preferences?.notifications?.push ?? true,
          sms: document.preferences?.notifications?.sms ?? false,
          marketing: document.preferences?.notifications?.marketing ?? true,
          orderUpdates: document.preferences?.notifications?.orderUpdates ?? true,
          newOffers: document.preferences?.notifications?.newOffers ?? true,
        },
        dietary: {
          vegetarian: document.preferences?.dietary?.vegetarian ?? false,
          vegan: document.preferences?.dietary?.vegan ?? false,
          glutenFree: document.preferences?.dietary?.glutenFree ?? false,
          halal: document.preferences?.dietary?.halal ?? false,
          kosher: document.preferences?.dietary?.kosher ?? false,
          allergies: document.preferences?.dietary?.allergies ?? [],
        },
        delivery: {
          defaultAddress: document.preferences?.delivery?.defaultAddress,
          preferredTimeSlots: document.preferences?.delivery?.preferredTimeSlots ?? [],
          instructions: document.preferences?.delivery?.instructions,
        },
        language: document.preferences?.language ?? 'en',
        currency: document.preferences?.currency ?? 'EUR',
        timezone: document.preferences?.timezone ?? 'Europe/Paris',
      },
      address: document.address
        ? {
            street: document.address.street ?? '',
            city: document.address.city ?? '',
            state: document.address.state ?? '',
            postalCode: document.address.postalCode ?? '',
            country: document.address.country ?? '',
            isDefault: document.address.isDefault ?? false,
            coordinates: document.address.coordinates
              ? {
                  latitude: document.address.coordinates.latitude ?? 0,
                  longitude: document.address.coordinates.longitude ?? 0,
                }
              : undefined,
          }
        : undefined,
      loyaltyPoints: document.loyaltyPoints ?? 0,
      totalOrders: document.stats?.totalOrders ?? 0,
      totalSpent: document.stats?.totalSpent ?? 0,
      averageRating: document.stats?.averageRating,
      lastLoginAt: document.lastLoginAt,
      createdAt: document.createdAt ?? new Date(),
      updatedAt: document.updatedAt ?? new Date(),
    };
  }

  static toInterfaceArray(documents: UserLike[]): IUser[] {
    return documents.map((doc) => this.toInterface(doc));
  }

  static toStatsInterface(data: StatsLike): IUserStats {
    return {
      totalUsers: data.totalUsers ?? 0,
      activeUsers: data.activeUsers ?? 0,
      newUsersToday: data.newUsersToday ?? 0,
      newUsersThisWeek: data.newUsersThisWeek ?? 0,
      newUsersThisMonth: data.newUsersThisMonth ?? 0,
      averageOrdersPerUser: data.averageOrdersPerUser ?? 0,
      topSpenders:
        data.topSpenders?.map((spender: SpenderRecord) => ({
          userId: spender.userId ?? spender._id?.toString() ?? '',
          email: spender.email ?? '',
          firstName: spender.firstName ?? '',
          lastName: spender.lastName ?? '',
          totalSpent: spender.totalSpent ?? 0,
          totalOrders: spender.totalOrders ?? 0,
        })) ?? [],
    };
  }

  static toListResponse(data: ListResponseLike): IUserListResponse {
    return {
      users: this.toInterfaceArray(data.users ?? []),
      total: data.total ?? 0,
      page: data.page ?? 1,
      limit: data.limit ?? 20,
      totalPages: data.totalPages ?? 0,
    };
  }
}
