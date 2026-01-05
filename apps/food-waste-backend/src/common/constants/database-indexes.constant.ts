/**
 * Enterprise-Grade MongoDB Index Definitions
 *
 * Critical for production performance - indexes reduce query time from O(n) to O(log n)
 *
 * Index Strategy:
 * 1. **Single-field indexes**: For simple equality queries
 * 2. **Compound indexes**: For queries with multiple filters (order matters!)
 * 3. **Sparse indexes**: For optional fields (saves disk space)
 * 4. **Unique indexes**: For uniqueness constraints (email, orderNumber)
 * 5. **Geospatial indexes**: For location-based queries
 * 6. **Text indexes**: For full-text search
 *
 * Performance Impact:
 * - Without indexes: Query scans ALL documents (10K documents = 10K comparisons)
 * - With indexes: Query uses B-tree lookup (10K documents = ~13 comparisons)
 *
 * References:
 * - MongoDB Indexing: https://www.mongodb.com/docs/manual/indexes/
 * - Compound Index Order: https://www.mongodb.com/docs/manual/core/index-compound/
 * - ESR Rule: Equality, Sort, Range
 */

import { IndexDefinition } from 'mongoose';

/**
 * User Collection Indexes
 * Collection: users
 */
export const USER_INDEXES: { fields: Record<string, 1 | -1 | string>; options?: any }[] = [
    // Unique index for authentication (login queries)
    {
        fields: { email: 1 },
        options: { unique: true, name: 'idx_users_email_unique' }
    },

    // Sparse index for phone number (not all users have phones)
    {
        fields: { phoneNumber: 1 },
        options: { sparse: true, name: 'idx_users_phoneNumber_sparse' }
    },

    // Compound index for admin user listings (status + role + createdAt)
    // ESR: Equality (status), Equality (role), Range (createdAt)
    {
        fields: { status: 1, role: 1, createdAt: -1 },
        options: { name: 'idx_users_status_role_createdAt' }
    },

    // Index for soft delete queries
    {
        fields: { deletedAt: 1 },
        options: { sparse: true, name: 'idx_users_deletedAt_sparse' }
    },

    // Index for last login tracking
    {
        fields: { lastLoginAt: -1 },
        options: { name: 'idx_users_lastLoginAt' }
    }
];

/**
 * Order Collection Indexes
 * Collection: orders
 */
export const ORDER_INDEXES: { fields: Record<string, 1 | -1 | string>; options?: any }[] = [
    // Unique index for order number (external reference)
    {
        fields: { orderNumber: 1 },
        options: { unique: true, name: 'idx_orders_orderNumber_unique' }
    },

    // Compound index for customer order history (customerId + createdAt)
    // ESR: Equality (customerId), Range (createdAt)
    {
        fields: { customerId: 1, createdAt: -1 },
        options: { name: 'idx_orders_customerId_createdAt' }
    },

    // Compound index for merchant order management (merchantId + status + createdAt)
    // ESR: Equality (merchantId), Equality (status), Range (createdAt)
    {
        fields: { merchantId: 1, status: 1, createdAt: -1 },
        options: { name: 'idx_orders_merchantId_status_createdAt' }
    },

    // Compound index for establishment orders (establishmentId + status + createdAt)
    {
        fields: { establishmentId: 1, status: 1, createdAt: -1 },
        options: { name: 'idx_orders_establishmentId_status_createdAt' }
    },

    // Index for expiration cron job (expiresAt + status)
    // CRITICAL: Used by cron job to find expiring orders
    {
        fields: { expiresAt: 1, status: 1 },
        options: { name: 'idx_orders_expiresAt_status' }
    },

    // Index for pickup date queries (pickupDetails.scheduledDate + status)
    {
        fields: { 'pickupDetails.scheduledDate': 1, status: 1 },
        options: { name: 'idx_orders_pickupDate_status' }
    },

    // Index for payment status filtering
    {
        fields: { paymentStatus: 1, createdAt: -1 },
        options: { name: 'idx_orders_paymentStatus_createdAt' }
    }
];

/**
 * Establishment Collection Indexes
 * Collection: establishments
 */
export const ESTABLISHMENT_INDEXES: { fields: Record<string, 1 | -1 | string>; options?: any }[] = [
    // Index for owner lookup (findByOwnerId)
    {
        fields: { ownerId: 1, createdAt: -1 },
        options: { name: 'idx_establishments_ownerId_createdAt' }
    },

    // Geospatial index for nearby searches (getNearby)
    // CRITICAL: Required for $geoNear and $near queries
    {
        fields: { 'address.coordinates': '2dsphere' },
        options: { name: 'idx_establishments_coordinates_2dsphere' }
    },

    // Compound index for filtered listings (status + isVerified + createdAt)
    {
        fields: { status: 1, isVerified: 1, createdAt: -1 },
        options: { name: 'idx_establishments_status_isVerified_createdAt' }
    },

    // Index for active establishments (findAll with default filters)
    {
        fields: { isActive: 1, status: 1, createdAt: -1 },
        options: { name: 'idx_establishments_isActive_status_createdAt' }
    },

    // Index for type-based filtering
    {
        fields: { type: 1, averageRating: -1 },
        options: { name: 'idx_establishments_type_averageRating' }
    },

    // Text index for search (name, description)
    {
        fields: { name: 'text', description: 'text' },
        options: { name: 'idx_establishments_text_search' }
    }
];

/**
 * Offer Collection Indexes
 * Collection: offers
 */
export const OFFER_INDEXES: { fields: Record<string, 1 | -1 | string>; options?: any }[] = [
    // Compound index for merchant offers (merchantId + status + createdAt)
    {
        fields: { merchantId: 1, status: 1, createdAt: -1 },
        options: { name: 'idx_offers_merchantId_status_createdAt' }
    },

    // Compound index for establishment offers (establishmentId + status + createdAt)
    {
        fields: { establishmentId: 1, status: 1, createdAt: -1 },
        options: { name: 'idx_offers_establishmentId_status_createdAt' }
    },

    // Compound index for active offers (status + isActive + availableFrom + availableUntil)
    // CRITICAL: Used by findAll, getFeaturedOffers, getExpiringOffers
    {
        fields: { status: 1, isActive: 1, availableFrom: 1, availableUntil: 1 },
        options: { name: 'idx_offers_active_availability' }
    },

    // Index for featured offers
    {
        fields: { isFeatured: 1, status: 1, createdAt: -1 },
        options: { name: 'idx_offers_isFeatured_status_createdAt' }
    },

    // Index for expiring offers (availableUntil + status)
    // CRITICAL: Used by getExpiringOffers and cron jobs
    {
        fields: { availableUntil: 1, status: 1 },
        options: { name: 'idx_offers_availableUntil_status' }
    },

    // Index for price range filtering
    {
        fields: { 'pricing.discountedPrice': 1, status: 1 },
        options: { name: 'idx_offers_discountedPrice_status' }
    },

    // Index for discount percentage filtering
    {
        fields: { 'pricing.discountPercentage': -1, status: 1 },
        options: { name: 'idx_offers_discountPercentage_status' }
    },

    // Index for category filtering
    {
        fields: { categories: 1, status: 1 },
        options: { name: 'idx_offers_categories_status' }
    },

    // Text index for search (title, description)
    {
        fields: { title: 'text', description: 'text' },
        options: { name: 'idx_offers_text_search' }
    }
];

/**
 * Favorite Collection Indexes
 * Collection: favorites
 */
export const FAVORITE_INDEXES: { fields: Record<string, 1 | -1 | string>; options?: any }[] = [
    // Compound index for user favorites (userId + isActive + type + addedAt)
    {
        fields: { userId: 1, isActive: 1, type: 1, addedAt: -1 },
        options: { name: 'idx_favorites_userId_isActive_type_addedAt' }
    },

    // Unique compound index to prevent duplicate favorites
    {
        fields: { userId: 1, type: 1, itemId: 1 },
        options: { unique: true, name: 'idx_favorites_userId_type_itemId_unique' }
    },

    // Index for item-based queries (recommendations, collaborative filtering)
    {
        fields: { itemId: 1, isActive: 1 },
        options: { name: 'idx_favorites_itemId_isActive' }
    },

    // Index for recent interactions (recommendations algorithm)
    {
        fields: { userId: 1, lastInteraction: -1 },
        options: { name: 'idx_favorites_userId_lastInteraction' }
    },

    // Index for tag-based filtering
    {
        fields: { tags: 1, userId: 1 },
        options: { name: 'idx_favorites_tags_userId' }
    }
];

/**
 * FavoriteList Collection Indexes
 * Collection: favoritelists
 */
export const FAVORITE_LIST_INDEXES: { fields: Record<string, 1 | -1 | string>; options?: any }[] = [
    // Compound index for user lists (userId + isActive + createdAt)
    {
        fields: { userId: 1, isActive: 1, createdAt: -1 },
        options: { name: 'idx_favoritelists_userId_isActive_createdAt' }
    },

    // Index for shared lists
    {
        fields: { sharedWith: 1, visibility: 1 },
        options: { name: 'idx_favoritelists_sharedWith_visibility' }
    },

    // Index for public lists
    {
        fields: { visibility: 1, viewCount: -1 },
        options: { name: 'idx_favoritelists_visibility_viewCount' }
    }
];

/**
 * Review Collection Indexes (if exists)
 * Collection: reviews
 */
export const REVIEW_INDEXES: { fields: Record<string, 1 | -1 | string>; options?: any }[] = [
    // Compound index for establishment reviews
    {
        fields: { establishmentId: 1, isPublished: 1, createdAt: -1 },
        options: { name: 'idx_reviews_establishmentId_isPublished_createdAt' }
    },

    // Compound index for user reviews
    {
        fields: { userId: 1, createdAt: -1 },
        options: { name: 'idx_reviews_userId_createdAt' }
    },

    // Index for rating-based queries
    {
        fields: { rating: -1, createdAt: -1 },
        options: { name: 'idx_reviews_rating_createdAt' }
    }
];

/**
 * Notification Collection Indexes (if exists)
 * Collection: notifications
 */
export const NOTIFICATION_INDEXES: { fields: Record<string, 1 | -1 | string>; options?: any }[] = [
    // Compound index for user notifications
    {
        fields: { userId: 1, isRead: 1, createdAt: -1 },
        options: { name: 'idx_notifications_userId_isRead_createdAt' }
    },

    // Index for notification cleanup (TTL index)
    {
        fields: { createdAt: 1 },
        options: {
            name: 'idx_notifications_createdAt_ttl',
            expireAfterSeconds: 2592000 // 30 days
        }
    }
];

/**
 * Aggregate all indexes for easy import
 */
export const ALL_INDEXES = {
    users: USER_INDEXES,
    orders: ORDER_INDEXES,
    establishments: ESTABLISHMENT_INDEXES,
    offers: OFFER_INDEXES,
    favorites: FAVORITE_INDEXES,
    favoritelists: FAVORITE_LIST_INDEXES,
    reviews: REVIEW_INDEXES,
    notifications: NOTIFICATION_INDEXES,
};
