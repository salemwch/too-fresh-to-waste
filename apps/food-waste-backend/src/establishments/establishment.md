# Establishments Module Documentation

## Overview

The Establishments module manages food business locations (restaurants, bakeries, grocery stores, etc.) within the Too Fresh To Waste marketplace. It handles merchant registration, verification, geolocation-based discovery, legal document management, and business profile administration.

**Module Path:** `src/establishments/`
**API Base:** `/api/v1/establishments`
**Swagger Tag:** `🏪 Establishments Management`

---

## Table of Contents

1. [Architecture](#architecture)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [Business Logic](#business-logic)
5. [Security & Access Control](#security--access-control)
6. [Geolocation Features](#geolocation-features)
7. [Document Management](#document-management)
8. [Performance Optimizations](#performance-optimizations)
9. [Error Handling](#error-handling)
10. [Testing Considerations](#testing-considerations)

---

## Architecture

### Module Structure

```
establishments/
├── DTO/
│   ├── coordinates.dto.ts           # Geolocation coordinates
│   ├── create-establishment.dto.ts  # Creation payload validation
│   ├── update-establishment.dto.ts  # Update payload validation
│   ├── search-establishments.dto.ts # Search filters
│   └── upload-documents.dto.ts      # Document upload/verification
├── float/
│   └── parse-float.pipe.ts         # Float parsing for coordinates
├── schemas/
│   └── establishment.schema.ts     # Mongoose schema with indexes
├── establishments.controller.ts    # REST endpoints
├── establishments.service.ts       # Business logic
└── establishments.module.ts        # Module configuration
```

### Dependencies

- **CommonModule** - LocalStorageService for file uploads
- **MongooseModule** - Establishment schema registration
- **Guards** - JwtAuthGuard, RolesGuard
- **Decorators** - @Roles, @Sanitize
- **Interceptors** - FilesInterceptor, FileInterceptor (Multer)

---

## Database Schema

### Establishment Model

**Collection:** `establishments`
**Timestamps:** Enabled (createdAt, updatedAt)

#### Core Fields

| Field            | Type     | Required | Validation           | Description                          |
| ---------------- | -------- | -------- | -------------------- | ------------------------------------ |
| `name`           | String   | Yes      | 2-100 chars, trimmed | Business name                        |
| `description`    | String   | Yes      | Max 500 chars        | Business description                 |
| `ownerId`        | ObjectId | Yes      | Ref: User            | Merchant who owns this establishment |
| `type`           | Enum     | Yes      | EstablishmentType    | Business category                    |
| `status`         | Enum     | No       | Default: pending     | Approval workflow state              |
| `address`        | Object   | Yes      | Address interface    | Full address with geolocation        |
| `phoneNumber`    | String   | Yes      | E.164 format         | Contact phone (international)        |
| `email`          | String   | Yes      | Valid email          | Contact email                        |
| `website`        | String   | No       | -                    | Business website URL                 |
| `images`         | String[] | No       | Max 8 images         | Storefront/interior photos           |
| `cuisineTypes`   | String[] | No       | -                    | Food categories (for restaurants)    |
| `businessHours`  | Object   | No       | BusinessHours        | Weekly operating hours               |
| `legalDocuments` | Object   | No       | LegalDocuments       | Uploaded compliance docs             |

#### Enums

**EstablishmentType:**

```typescript
RESTAURANT | BAKERY | GROCERY_STORE | CAFE | FAST_FOOD | SUPERMARKET | HOTEL | OTHER;
```

**EstablishmentStatus:**

```typescript
PENDING; // Awaiting admin approval
ACTIVE; // Approved and operational
SUSPENDED; // Temporarily disabled
REJECTED; // Admin rejected application
INACTIVE; // Owner-disabled
```

#### Statistics & Metrics

| Field             | Type   | Default | Description           |
| ----------------- | ------ | ------- | --------------------- |
| `averageRating`   | Number | 0       | Rating (0-5)          |
| `totalReviews`    | Number | 0       | Review count          |
| `totalOffers`     | Number | 0       | Active offers count   |
| `completedOrders` | Number | 0       | Fulfilled order count |

#### Verification Fields

| Field             | Type    | Description                 |
| ----------------- | ------- | --------------------------- |
| `isActive`        | Boolean | Operational status flag     |
| `isVerified`      | Boolean | Admin verification status   |
| `verifiedAt`      | Date    | Verification timestamp      |
| `rejectionReason` | String  | Admin rejection explanation |

#### Soft Delete Fields

| Field            | Type    | Description          |
| ---------------- | ------- | -------------------- |
| `isDeleted`      | Boolean | Soft delete flag     |
| `deletedAt`      | Date    | Deletion timestamp   |
| `deletedBy`      | String  | User who deleted     |
| `deletionReason` | String  | Deletion explanation |

#### Address Interface

```typescript
{
  street: string; // "123 Main Street"
  city: string; // "Paris"
  postalCode: string; // "75001"
  country: string; // "France"
  coordinates: {
    type: 'Point'; // GeoJSON type
    coordinates: [number, number]; // [longitude, latitude]
  }
}
```

#### Business Hours Interface

```typescript
{
  monday: { open: "09:00", close: "17:00", closed: false },
  tuesday: { open: "09:00", close: "17:00", closed: false },
  // ... (all 7 days)
}
```

#### Legal Documents Interface

```typescript
{
  // Registration numbers (text)
  siret?: string;
  license?: string;
  vatNumber?: string;

  // Uploaded PDF documents with metadata
  businessLicenseUrl?: string;
  businessLicenseMetadata?: DocumentMetadata;

  foodSafetyLicenseUrl?: string;
  foodSafetyLicenseMetadata?: DocumentMetadata;

  insuranceDocumentUrl?: string;
  insuranceDocumentMetadata?: DocumentMetadata;

  taxCertificateUrl?: string;
  taxCertificateMetadata?: DocumentMetadata;

  ownerIdDocumentUrl?: string;
  ownerIdDocumentMetadata?: DocumentMetadata;

  additionalDocuments?: Array<{
    type: string;
    url: string;
    metadata: DocumentMetadata;
  }>;
}
```

#### Document Metadata Interface

```typescript
{
  fileName: string;       // "business_license.pdf"
  fileSize: number;       // Bytes
  mimeType: string;       // "application/pdf"
  uploadedAt: Date;       // Upload timestamp
  uploadedBy?: string;    // User ID
  verified?: boolean;     // Admin verification status
  verifiedAt?: Date;      // Verification timestamp
  verifiedBy?: string;    // Admin who verified
  expiryDate?: Date;      // Document expiry (if applicable)
  notes?: string;         // Admin/merchant notes
}
```

### Database Indexes

The schema includes 18 production-grade indexes for optimal query performance:

#### Base Indexes

1. **Geospatial Index:** `{ 'address.coordinates': '2dsphere' }`
   - Enables $near, $geoWithin queries
   - Query: `find({ 'address.coordinates': { $near: userLocation } })`

2. **Owner Management:** `{ ownerId: 1, status: 1 }`
   - Merchant dashboard filtering
   - Query: `find({ ownerId, status: 'active' })`

3. **Public Listing:** `{ status: 1, type: 1 }`
   - Type-filtered listing
   - Query: `find({ status: 'active', type: 'restaurant' })`

4. **Active Verified:** `{ isActive: 1, isVerified: 1 }`
   - Public-facing listings
   - Query: `find({ isActive: true, isVerified: true })`

5. **Full-Text Search:** `{ name: 'text', description: 'text' }`
   - Text search capability
   - Query: `find({ $text: { $search: 'pizza italian' } })`

#### Enterprise Optimization Indexes

6. **Email Lookup:** `{ email: 1 }`
7. **Phone Lookup:** `{ phoneNumber: 1 }`
8. **Premium Listing:** `{ isActive: 1, isVerified: 1, status: 1, averageRating: -1 }`
9. **Type + Rating:** `{ type: 1, isActive: 1, averageRating: -1 }`
10. **Verification Audit:** `{ isVerified: 1, verifiedAt: 1 }` (sparse)
11. **Pending Queue:** `{ status: 1, isVerified: 1, createdAt: 1 }`
12. **Activity Tracking:** `{ lastActiveAt: 1, isActive: 1 }` (sparse)
13. **Performance Analytics:** `{ ownerId: 1, completedOrders: -1, averageRating: -1 }`
14. **Rejection Analysis:** `{ status: 1, rejectionReason: 1 }` (sparse)
15. **Document Verification:** `{ 'legalDocuments.*.verified': 1 }` (sparse)
16. **City Discovery:** `{ 'address.city': 1, type: 1, isActive: 1 }`
17. **Scheduled Reactivation:** `{ 'metadata.scheduledReactivation.status': 1, 'metadata.scheduledReactivation.scheduledFor': 1 }` (sparse)
18. **Soft Delete Recovery:** `{ isDeleted: 1, deletedAt: 1 }` (sparse)

#### Query Middleware

**Auto-exclude soft-deleted records:**

```typescript
// Pre-find middleware
EstablishmentSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});

// Pre-aggregate middleware
EstablishmentSchema.pre('aggregate', function () {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
});
```

---

## API Endpoints

### Authentication

All endpoints require JWT authentication (`JwtAuthGuard`). Role-specific endpoints require `RolesGuard`.

### Endpoint Summary

| Method | Endpoint                                     | Roles           | Description                         |
| ------ | -------------------------------------------- | --------------- | ----------------------------------- |
| POST   | `/establishments`                            | MERCHANT        | Create new establishment            |
| GET    | `/establishments`                            | Public          | List all establishments (paginated) |
| GET    | `/establishments/my-establishment`           | MERCHANT        | Get merchant's establishments       |
| GET    | `/establishments/nearby`                     | Public          | Geolocation-based search            |
| GET    | `/establishments/pending`                    | ADMIN           | Pending approval queue              |
| GET    | `/establishments/:id`                        | Public          | Get establishment details           |
| GET    | `/establishments/:id/stats`                  | OWNER, ADMIN    | Get establishment statistics        |
| PATCH  | `/establishments/:id`                        | OWNER, ADMIN    | Update establishment                |
| PATCH  | `/establishments/:id/status`                 | ADMIN           | Update approval status              |
| PATCH  | `/establishments/:id/verify`                 | ADMIN           | Approve establishment               |
| PATCH  | `/establishments/:id/reject`                 | ADMIN           | Reject establishment                |
| POST   | `/establishments/:id/documents`              | MERCHANT, ADMIN | Upload legal document               |
| PATCH  | `/establishments/:id/documents/:type/verify` | ADMIN           | Verify document                     |
| DELETE | `/establishments/:id/documents/:type`        | OWNER, ADMIN    | Delete document                     |
| DELETE | `/establishments/:id`                        | OWNER, ADMIN    | Soft delete establishment           |

---

### 1. Create Establishment

**Endpoint:** `POST /establishments`
**Roles:** MERCHANT
**Content-Type:** `multipart/form-data`

#### Request Body

```json
{
  "name": "Fresh Corner Bakery",
  "description": "Artisanal bakery serving fresh bread and pastries daily",
  "type": "bakery",
  "address": {
    "street": "123 Main Street",
    "city": "Paris",
    "postalCode": "75001",
    "country": "France",
    "coordinates": {
      "type": "Point",
      "coordinates": [2.3522, 48.8566]
    }
  },
  "phoneNumber": "+33612345678",
  "email": "contact@freshcorner.fr",
  "website": "https://freshcorner.fr",
  "cuisineTypes": ["bakery", "french"],
  "businessHours": {
    "monday": { "open": "07:00", "close": "19:00", "closed": false },
    "tuesday": { "open": "07:00", "close": "19:00", "closed": false },
    "wednesday": { "open": "07:00", "close": "19:00", "closed": false },
    "thursday": { "open": "07:00", "close": "19:00", "closed": false },
    "friday": { "open": "07:00", "close": "19:00", "closed": false },
    "saturday": { "open": "08:00", "close": "18:00", "closed": false },
    "sunday": { "open": "00:00", "close": "00:00", "closed": true }
  },
  "acceptsReservations": true,
  "images": [
    /* File objects */
  ]
}
```

#### File Upload

- **Field name:** `images`
- **Max files:** 8
- **Formats:** JPEG, PNG, WebP
- **Max size:** 5MB per image
- **Processing:** Resized to 1000x750px, JPEG quality 85

#### Response (201 Created)

```json
{
  "message": "Establishment created successfully. Pending admin approval.",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Fresh Corner Bakery",
    "description": "Artisanal bakery...",
    "type": "bakery",
    "status": "pending",
    "images": [
      "http://localhost:3000/storage/establishments/storefront_1625097600000_abc123.jpg",
      "http://localhost:3000/storage/establishments/interior_1625097600000_def456.jpg"
    ],
    "address": {
      /* ... */
    },
    "phoneNumber": "+33612345678",
    "email": "contact@freshcorner.fr",
    "ownerId": "507f1f77bcf86cd799439022",
    "createdAt": "2025-10-26T10:00:00.000Z",
    "updatedAt": "2025-10-26T10:00:00.000Z"
  }
}
```

#### Business Rules

1. **One establishment per merchant** - Duplicate check by `ownerId`
2. **Default status** - `pending` (requires admin approval)
3. **Phone validation** - E.164 international format required
4. **Coordinate validation** - Longitude [-180, 180], Latitude [-90, 90]
5. **Image optimization** - Automatically resized and compressed

---

### 2. List Establishments

**Endpoint:** `GET /establishments?page=1&limit=10`
**Roles:** Public (authenticated users)

#### Query Parameters

| Parameter             | Type    | Default | Description                          |
| --------------------- | ------- | ------- | ------------------------------------ |
| `page`                | Number  | 1       | Page number                          |
| `limit`               | Number  | 10      | Items per page (max 100)             |
| `search`              | String  | -       | Full-text search (name, description) |
| `type`                | Enum    | -       | Filter by establishment type         |
| `status`              | Enum    | -       | Filter by status                     |
| `latitude`            | Number  | -       | User location latitude               |
| `longitude`           | Number  | -       | User location longitude              |
| `maxDistance`         | Number  | 5000    | Search radius in meters              |
| `minRating`           | Number  | -       | Minimum rating filter                |
| `isVerified`          | Boolean | -       | Verified establishments only         |
| `acceptsReservations` | Boolean | -       | Reservation-enabled only             |

#### Response (200 OK)

```json
{
  "message": "Establishments retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Fresh Corner Bakery",
      "type": "bakery",
      "status": "active",
      "address": {
        /* ... */
      },
      "images": ["..."],
      "averageRating": 4.5,
      "totalReviews": 123,
      "isVerified": true
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

#### Query Optimization

- **Field selection:** Only essential fields returned (not full document)
- **Lean queries:** `.lean()` for 50% memory reduction
- **Population:** Owner info pre-fetched (firstName, lastName, email, phoneNumber)
- **Max limit:** Capped at 100 to prevent DOS

---

### 3. Get My Establishments

**Endpoint:** `GET /establishments/my-establishment`
**Roles:** MERCHANT

#### Response (200 OK)

```json
{
  "message": "Your establishments retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Fresh Corner Bakery",
      "status": "active",
      "totalOffers": 12,
      "completedOrders": 456,
      "averageRating": 4.5
      /* Full establishment details */
    }
  ]
}
```

---

### 4. Nearby Establishments

**Endpoint:** `GET /establishments/nearby?longitude=2.3522&latitude=48.8566&maxDistance=5000`
**Roles:** Public

#### Query Parameters (Required)

- `longitude` (Float): User longitude [-180, 180]
- `latitude` (Float): User latitude [-90, 90]
- `maxDistance` (Integer): Search radius in meters (default: 5000)

#### Response (200 OK)

```json
{
  "message": "Nearby establishments retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Fresh Corner Bakery",
      "address": {
        "street": "123 Main Street",
        "city": "Paris",
        "coordinates": {
          "type": "Point",
          "coordinates": [2.3522, 48.8566]
        }
      },
      "distance": 450, // meters (calculated by MongoDB)
      "averageRating": 4.5,
      "isVerified": true
    }
  ]
}
```

#### Geospatial Query

Uses MongoDB `$near` operator with 2dsphere index:

```typescript
{
  status: 'active',
  isActive: true,
  'address.coordinates': {
    $near: {
      $geometry: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      $maxDistance: maxDistance
    }
  }
}
```

---

### 5. Pending Approvals (Admin)

**Endpoint:** `GET /establishments/pending?page=1&limit=10`
**Roles:** ADMIN

#### Response (200 OK)

```json
{
  "message": "Pending establishments retrieved successfully",
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Fresh Corner Bakery",
      "status": "pending",
      "ownerId": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "createdAt": "2025-10-26T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 8,
    "totalPages": 1
  }
}
```

---

### 6. Get Establishment Details

**Endpoint:** `GET /establishments/:id`
**Roles:** Public

#### Response (200 OK)

```json
{
  "message": "Establishment retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Fresh Corner Bakery",
    "description": "Artisanal bakery...",
    "type": "bakery",
    "status": "active",
    "address": {
      /* ... */
    },
    "phoneNumber": "+33612345678",
    "email": "contact@freshcorner.fr",
    "website": "https://freshcorner.fr",
    "images": ["..."],
    "cuisineTypes": ["bakery", "french"],
    "businessHours": {
      /* ... */
    },
    "averageRating": 4.5,
    "totalReviews": 123,
    "totalOffers": 12,
    "completedOrders": 456,
    "isVerified": true,
    "verifiedAt": "2025-10-27T14:30:00.000Z",
    "ownerId": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "createdAt": "2025-10-26T10:00:00.000Z",
    "updatedAt": "2025-10-27T14:30:00.000Z"
  }
}
```

---

### 7. Get Establishment Statistics

**Endpoint:** `GET /establishments/:id/stats`
**Roles:** OWNER (of establishment), ADMIN

#### Response (200 OK)

```json
{
  "message": "Establishment stats retrieved successfully",
  "data": {
    "totalOffers": 12,
    "completedOrders": 456,
    "averageRating": 4.5,
    "totalReviews": 123
  }
}
```

#### Access Control

Non-owners and non-admins receive:

```json
{
  "message": "Access denied",
  "data": null
}
```

---

### 8. Update Establishment

**Endpoint:** `PATCH /establishments/:id`
**Roles:** OWNER (of establishment), ADMIN
**Content-Type:** `multipart/form-data`

#### Request Body (Partial Update)

```json
{
  "name": "Updated Bakery Name",
  "description": "New description",
  "images": [
    /* New file objects */
  ]
}
```

#### Image Handling

- New images are **appended** to existing images (not replaced)
- To replace images, delete establishment and recreate (or implement image removal endpoint)

#### Response (200 OK)

```json
{
  "message": "Establishment updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Updated Bakery Name"
    /* Full updated establishment */
  }
}
```

#### Business Rules

1. **Owner verification** - Only owner or admin can update
2. **Status protection** - Merchants cannot change status (admin only)
3. **Image merging** - New images added to existing array

---

### 9. Update Status (Admin)

**Endpoint:** `PATCH /establishments/:id/status`
**Roles:** ADMIN

#### Request Body

```json
{
  "status": "active",
  "rejectionReason": "License expired" // Only for status: 'rejected'
}
```

#### Response (200 OK)

```json
{
  "message": "Establishment status updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "active",
    "isVerified": true,
    "verifiedAt": "2025-10-27T14:30:00.000Z"
  }
}
```

#### Status Transitions

- **pending → active**: Sets `isVerified: true`, `verifiedAt: Date`
- **pending → rejected**: Requires `rejectionReason`
- **active → suspended**: Temporary suspension (can reactivate)
- **suspended → active**: Reactivation
- **\* → inactive**: Owner-initiated pause

---

### 10. Quick Verify (Admin)

**Endpoint:** `PATCH /establishments/:id/verify`
**Roles:** ADMIN

Shortcut for `PATCH /establishments/:id/status` with `status: 'active'`

#### Response (200 OK)

```json
{
  "message": "Establishment verified successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "active",
    "isVerified": true,
    "verifiedAt": "2025-10-27T14:30:00.000Z"
  }
}
```

---

### 11. Quick Reject (Admin)

**Endpoint:** `PATCH /establishments/:id/reject`
**Roles:** ADMIN

Shortcut for `PATCH /establishments/:id/status` with `status: 'rejected'`

#### Request Body

```json
{
  "reason": "Business license verification failed"
}
```

#### Response (200 OK)

```json
{
  "message": "Establishment rejected successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "status": "rejected",
    "rejectionReason": "Business license verification failed"
  }
}
```

---

### 12. Upload Legal Document

**Endpoint:** `POST /establishments/:id/documents`
**Roles:** MERCHANT (owner), ADMIN
**Content-Type:** `multipart/form-data`

#### Request Body

```json
{
  "documentType": "business_license",
  "expiryDate": "2025-12-31",
  "notes": "Valid for food handling and preparation",
  "document": /* PDF file */
}
```

#### Document Types

```typescript
enum DocumentType {
  BUSINESS_LICENSE        // Business registration license
  FOOD_SAFETY_LICENSE     // Health department certification
  INSURANCE_DOCUMENT      // Liability insurance
  TAX_CERTIFICATE         // Tax registration
  OWNER_ID_DOCUMENT       // Owner identification
  ADDITIONAL              // Other supporting documents
}
```

#### File Validation

- **Format:** PDF only (`application/pdf`)
- **Max size:** 5MB (configurable)
- **Storage:** Local file system via LocalStorageService
- **Path:** `storage/establishments/{id}/documents/`

#### Response (201 Created)

```json
{
  "success": true,
  "message": "business license uploaded successfully",
  "document": {
    "type": "business_license",
    "url": "http://localhost:3000/storage/establishments/.../business_license.pdf",
    "fileName": "business_license.pdf",
    "fileSize": 245760,
    "mimeType": "application/pdf",
    "uploadedAt": "2025-10-26T10:30:00.000Z",
    "expiryDate": "2025-12-31T00:00:00.000Z",
    "notes": "Valid for food handling and preparation",
    "verified": false
  },
  "establishment": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Fresh Corner Bakery",
    "status": "pending"
  }
}
```

---

### 13. Verify Document (Admin)

**Endpoint:** `PATCH /establishments/:id/documents/:documentType/verify`
**Roles:** ADMIN

#### Request Body

```json
{
  "notes": "Document verified - valid until 2025"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "business license verified successfully",
  "establishment": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Fresh Corner Bakery",
    "status": "pending"
  }
}
```

#### Side Effects

Updates document metadata:

- `verified: true`
- `verifiedAt: Date`
- `verifiedBy: adminUserId`
- `notes: string`

---

### 14. Delete Document

**Endpoint:** `DELETE /establishments/:id/documents/:documentType`
**Roles:** OWNER (of establishment), ADMIN

#### Response (200 OK)

```json
{
  "success": true,
  "message": "business license deleted successfully"
}
```

#### Business Rules

1. Removes document URL and metadata from database
2. **Does NOT delete physical file** (for audit trail)
3. Owner can only delete from their own establishments
4. Admins can delete any document

---

### 15. Delete Establishment (Soft Delete)

**Endpoint:** `DELETE /establishments/:id`
**Roles:** OWNER (of establishment), ADMIN

#### Response (204 No Content)

```json
{
  "message": "Establishment deleted successfully"
}
```

#### Soft Delete Behavior

Sets the following fields:

- `isDeleted: true`
- `deletedAt: Date`
- `deletedBy: userId`
- `deletionReason: string`
- `isActive: false`
- `status: 'inactive'`

**Query middleware** automatically excludes soft-deleted establishments from all queries.

#### Recovery

To restore a soft-deleted establishment:

```typescript
await establishmentModel.updateOne(
  { _id: id },
  { isDeleted: false, deletedAt: null, isActive: true, status: 'active' },
);
```

---

## Business Logic

### EstablishmentsService

Located at: `establishments.service.ts`

#### Key Methods

##### `create(dto, ownerId): Promise<EstablishmentDocument>`

Creates a new establishment with ownership assignment.

**Business Rules:**

- One establishment per merchant (checks existing `ownerId`)
- Default status: `pending`
- Coordinates validated at schema level

**Error Handling:**

- Throws `ConflictException` if merchant already has establishment

---

##### `findAll(page, limit, filters): Promise<FindAllResult>`

Paginated establishment listing with advanced filtering.

**Filters:**

- Full-text search (`$text` operator)
- Type, status, verification status
- Minimum rating filter
- Geospatial proximity (if lat/lng provided)
- Reservation capability

**Optimizations:**

- Safe limit: `Math.min(limit, 100)` to prevent DOS
- Field selection via `ESTABLISHMENT_LIST_FIELDS`
- Lean queries for 50% memory reduction
- Population of owner info

**Return:**

```typescript
{
  establishments: EstablishmentLean[];
  total: number;
}
```

---

##### `findById(id): Promise<EstablishmentDocument>`

Retrieves single establishment by ID.

**Features:**

- ObjectId validation
- Owner population
- Throws `NotFoundException` if not found

---

##### `findByOwnerId(ownerId, page, limit): Promise<FindAllResult>`

Merchant's establishment portfolio (enterprise-grade pagination).

**Use Case:** Merchant dashboard

**Optimizations:**

- Paginated to prevent loading thousands of establishments
- Safe limit capping
- Lean queries
- Sorted by `createdAt: -1`

---

##### `update(id, dto, userId, userRole): Promise<EstablishmentDocument>`

Updates establishment with ownership verification.

**Access Control:**

- Owner or admin can update
- Merchants cannot change `status` field
- Admin can change any field

**Return:** Updated document with populated owner

---

##### `updateStatus(id, status, rejectionReason?): Promise<EstablishmentDocument>`

Admin-only status management.

**Status-specific logic:**

- `active`: Sets `isVerified: true`, `verifiedAt: Date`
- `rejected`: Requires `rejectionReason`

---

##### `getNearby(lng, lat, maxDistance, page, limit): Promise<FindAllResult>`

Geospatial proximity search.

**Query:**

```typescript
{
  status: 'active',
  isActive: true,
  'address.coordinates': {
    $near: {
      $geometry: { type: 'Point', coordinates: [lng, lat] },
      $maxDistance: maxDistance
    }
  }
}
```

**Features:**

- Paginated results
- Excludes inactive/non-verified establishments
- Results sorted by distance (automatic via $near)

---

##### `remove(id, userId, userRole, deletionReason?): Promise<void>`

Soft delete implementation.

**Access Control:**

- Owner or admin can delete

**Side Effects:**

- Marks as deleted (does not remove from database)
- Sets `status: 'inactive'`, `isActive: false`
- Records deletion metadata (who, when, why)

---

##### `uploadDocument(establishmentId, documentType, documentUrl, metadata, userId, userRole): Promise<EstablishmentDocument>`

Enterprise-grade document management.

**Features:**

- Ownership verification
- Document type categorization
- Full metadata tracking
- Support for multiple document types
- Additional documents array

**Document Types Handled:**

- Business license
- Food safety license
- Insurance document
- Tax certificate
- Owner ID document
- Additional documents (array)

---

##### `verifyDocument(establishmentId, documentType, verifiedBy, notes?): Promise<EstablishmentDocument>`

Admin-only document verification.

**Updates Metadata:**

- `verified: true`
- `verifiedAt: Date`
- `verifiedBy: adminUserId`
- `notes: string`

---

##### `deleteDocument(establishmentId, documentType, userId, userRole): Promise<EstablishmentDocument>`

Removes document reference from establishment.

**Access Control:**

- Owner or admin only

**Important:** Does not delete physical file (audit trail preservation)

---

## Security & Access Control

### Authentication

All endpoints require JWT authentication via `JwtAuthGuard`.

**Header:**

```
Authorization: Bearer <jwt_token>
```

### Role-Based Access Control (RBAC)

| Role         | Permissions                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **MERCHANT** | Create establishment, update own establishment, upload documents to own establishment, view own stats                          |
| **ADMIN**    | All merchant permissions + approve/reject establishments, verify documents, update any establishment, delete any establishment |
| **CONSUMER** | View public establishments, search, view details                                                                               |

### Resource Ownership

Implemented via ownership checks in service methods:

```typescript
if (userRole !== 'admin' && establishment.ownerId.toString() !== userId) {
  throw new ForbiddenException('You can only update your own establishment');
}
```

### Input Validation

- **DTOs:** class-validator decorators
- **Sanitization:** GlobalSanitizationMiddleware (XSS prevention)
- **Whitelist mode:** ValidationPipe strips unknown properties
- **Transform pipes:** Trim strings, lowercase emails

### File Upload Security

- **Type validation:** Only PDF for documents, JPEG/PNG/WebP for images
- **Size limits:** 5MB max per file
- **Storage isolation:** Files stored in separate folders per establishment
- **Path traversal prevention:** LocalStorageService sanitizes filenames

---

## Geolocation Features

### GeoJSON Format

All coordinates stored as GeoJSON `Point`:

```json
{
  "type": "Point",
  "coordinates": [longitude, latitude]
}
```

**Important:** GeoJSON uses `[longitude, latitude]` order (opposite of Google Maps).

### Coordinate Validation

Schema-level validation:

```typescript
validate: {
  validator(coords: number[]) {
    return coords.length === 2 &&
           coords[0] >= -180 && coords[0] <= 180 &&  // Longitude
           coords[1] >= -90 && coords[1] <= 90;      // Latitude
  },
  message: 'Invalid coordinates format'
}
```

### Geospatial Queries

**Nearby search:**

```typescript
db.establishments.find({
  'address.coordinates': {
    $near: {
      $geometry: { type: 'Point', coordinates: [2.3522, 48.8566] },
      $maxDistance: 5000, // meters
    },
  },
});
```

**Within polygon:**

```typescript
db.establishments.find({
  'address.coordinates': {
    $geoWithin: {
      $geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [lng1, lat1],
            [lng2, lat2],
            [lng3, lat3],
            [lng4, lat4],
            [lng1, lat1],
          ],
        ],
      },
    },
  },
});
```

### Distance Calculation

MongoDB's `$near` operator automatically sorts results by distance. To get actual distance values, use aggregation with `$geoNear`:

```typescript
db.establishments.aggregate([
  {
    $geoNear: {
      near: { type: 'Point', coordinates: [2.3522, 48.8566] },
      distanceField: 'distance',
      maxDistance: 5000,
      spherical: true,
    },
  },
]);
```

---

## Document Management

### Document Lifecycle

1. **Upload** → `POST /establishments/:id/documents`
   - Merchant uploads PDF
   - File stored in `storage/establishments/{id}/documents/`
   - Metadata saved in database
   - `verified: false`

2. **Verification** → `PATCH /establishments/:id/documents/:type/verify`
   - Admin reviews document
   - Sets `verified: true`, `verifiedAt`, `verifiedBy`
   - Adds verification notes

3. **Deletion** → `DELETE /establishments/:id/documents/:type`
   - Removes database reference
   - Physical file retained for audit trail

### Document Types & Requirements

| Document Type       | Required               | Expiry | Notes                           |
| ------------------- | ---------------------- | ------ | ------------------------------- |
| Business License    | Recommended            | Yes    | Legal business registration     |
| Food Safety License | Required (restaurants) | Yes    | Health department certification |
| Insurance Document  | Recommended            | Yes    | Liability coverage              |
| Tax Certificate     | Recommended            | Yes    | Tax registration proof          |
| Owner ID Document   | Required               | No     | Identity verification           |
| Additional          | Optional               | Varies | Supporting documents            |

### Expiry Tracking

Documents can have `expiryDate` field for compliance monitoring:

```typescript
// Find establishments with expiring documents
db.establishments.find({
  'legalDocuments.foodSafetyLicenseMetadata.expiryDate': {
    $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  },
});
```

### Audit Trail

All document operations tracked via metadata:

- `uploadedAt`, `uploadedBy`
- `verifiedAt`, `verifiedBy`
- `notes` for verification comments

---

## Performance Optimizations

### Query Optimization

1. **Field Selection**
   - List views: `ESTABLISHMENT_LIST_FIELDS` (subset of fields)
   - Detail views: Full document
   - Stats views: Only statistics fields

2. **Lean Queries**
   - `.lean()` converts Mongoose docs to POJOs
   - 50% memory reduction
   - No virtuals, getters, or methods

3. **Population Strategy**
   - Owner info pre-fetched in single query
   - Limited fields: `firstName lastName email phoneNumber`

4. **Pagination**
   - Max limit capped at 100
   - Skip/limit pattern for scalability

### Index Strategy

18 indexes covering:

- Geospatial queries (2dsphere)
- Owner filtering
- Status/type filtering
- Full-text search
- Verification tracking
- Activity monitoring
- Document verification
- Soft delete recovery

### Query Middleware Optimization

Auto-filter soft-deleted records at middleware level (prevents accidental exposure):

```typescript
EstablishmentSchema.pre(/^find/, function (next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});
```

### Aggregation Pipeline

For complex queries, use aggregation with `$match` → `$lookup` → `$project`:

```typescript
db.establishments.aggregate([
  { $match: { isDeleted: { $ne: true }, status: 'active' } },
  { $lookup: { from: 'users', localField: 'ownerId', foreignField: '_id', as: 'owner' } },
  { $project: { name: 1, type: 1, 'owner.firstName': 1, 'owner.lastName': 1 } },
  { $sort: { averageRating: -1 } },
  { $limit: 10 },
]);
```

---

## Error Handling

### Common Error Codes

| HTTP Code | Exception             | Scenario                                       |
| --------- | --------------------- | ---------------------------------------------- |
| 400       | BadRequestException   | Invalid ObjectId, coordinate format, file type |
| 401       | UnauthorizedException | Missing/invalid JWT token                      |
| 403       | ForbiddenException    | Non-owner trying to update/delete              |
| 404       | NotFoundException     | Establishment not found                        |
| 409       | ConflictException     | Merchant already has establishment             |

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Invalid establishment ID",
  "error": "Bad Request",
  "timestamp": "2025-10-26T10:00:00.000Z",
  "path": "/api/v1/establishments/invalid-id"
}
```

### Validation Errors

class-validator DTOs produce detailed validation errors:

```json
{
  "statusCode": 400,
  "message": [
    "name must be longer than or equal to 2 characters",
    "Please provide a valid email address",
    "phoneNumber must be a valid phone number in international format"
  ],
  "error": "Bad Request"
}
```

### File Upload Errors

```json
{
  "statusCode": 400,
  "message": "Only PDF documents are allowed for legal documents",
  "error": "Bad Request"
}
```

---

## Testing Considerations

### Unit Tests

**File:** `establishments.service.spec.ts`

**Test Cases:**

- `create()` - Success, duplicate owner conflict
- `findAll()` - Pagination, filtering, geospatial queries
- `findById()` - Success, invalid ID, not found
- `update()` - Owner update, admin update, forbidden
- `updateStatus()` - Status transitions, verification
- `remove()` - Soft delete, ownership check
- `uploadDocument()` - Success, forbidden, invalid type
- `verifyDocument()` - Admin verification
- `deleteDocument()` - Deletion, ownership check

### Integration Tests

**File:** `establishments.controller.spec.ts`

**Test Cases:**

- POST `/establishments` - Full creation flow with file upload
- GET `/establishments` - Pagination, filters
- GET `/establishments/nearby` - Geospatial search
- PATCH `/establishments/:id` - Update with ownership
- DELETE `/establishments/:id` - Soft delete

### E2E Tests

**File:** `test/establishments.e2e-spec.ts`

**Scenarios:**

1. Merchant registration flow
2. Admin approval workflow
3. Document upload/verification flow
4. Geolocation-based discovery
5. Soft delete and recovery

### Test Database

Use `mongodb-memory-server` for isolated testing:

```typescript
beforeAll(async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  // Connect to test database
});

afterAll(async () => {
  await mongod.stop();
});
```

### Mock Data

```typescript
const mockEstablishment = {
  name: 'Test Bakery',
  description: 'Test description',
  type: EstablishmentType.BAKERY,
  address: {
    street: '123 Test St',
    city: 'Test City',
    postalCode: '12345',
    country: 'Test Country',
    coordinates: { type: 'Point', coordinates: [2.3522, 48.8566] },
  },
  phoneNumber: '+33612345678',
  email: 'test@bakery.com',
  ownerId: new Types.ObjectId(),
};
```

---

## API Usage Examples

### Create Establishment (cURL)

```bash
curl -X POST http://localhost:3000/api/v1/establishments \
  -H "Authorization: Bearer <jwt_token>" \
  -F "name=Fresh Corner Bakery" \
  -F "description=Artisanal bakery serving fresh bread" \
  -F "type=bakery" \
  -F "address[street]=123 Main Street" \
  -F "address[city]=Paris" \
  -F "address[postalCode]=75001" \
  -F "address[country]=France" \
  -F "address[coordinates][type]=Point" \
  -F "address[coordinates][coordinates][0]=2.3522" \
  -F "address[coordinates][coordinates][1]=48.8566" \
  -F "phoneNumber=+33612345678" \
  -F "email=contact@freshcorner.fr" \
  -F "images=@storefront.jpg" \
  -F "images=@interior.jpg"
```

### Search Nearby (JavaScript)

```javascript
const searchNearby = async (latitude, longitude, maxDistance = 5000) => {
  const response = await fetch(
    `http://localhost:3000/api/v1/establishments/nearby?` +
      `latitude=${latitude}&longitude=${longitude}&maxDistance=${maxDistance}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();
  return data.data; // Array of establishments
};
```

### Upload Document (TypeScript)

```typescript
const uploadDocument = async (
  establishmentId: string,
  documentType: DocumentType,
  file: File,
  expiryDate?: string,
) => {
  const formData = new FormData();
  formData.append('documentType', documentType);
  formData.append('document', file);
  if (expiryDate) formData.append('expiryDate', expiryDate);

  const response = await fetch(
    `http://localhost:3000/api/v1/establishments/${establishmentId}/documents`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    },
  );

  return await response.json();
};
```

---

## Related Modules

- **Auth Module** - JWT authentication, user roles
- **Users Module** - Owner (merchant) profile management
- **Offers Module** - Surplus food listings for establishments
- **Orders Module** - Order processing for establishment offers
- **Reviews Module** - Rating/review system (updates `averageRating`, `totalReviews`)
- **Common Module** - LocalStorageService for file uploads

---

## Future Enhancements

1. **Opening Hours Validation**
   - Validate time format (HH:MM)
   - Check open < close times
   - Timezone support

2. **Multi-Location Support**
   - Allow merchants to own multiple establishments
   - Chain/franchise management

3. **Image Management**
   - Individual image deletion
   - Image reordering
   - Primary image designation

4. **Document Expiry Notifications**
   - Automated reminders for expiring documents
   - Email/SMS alerts

5. **Verification Workflow**
   - Multi-step verification process
   - Verification checklist
   - Admin notes/communication

6. **Analytics Dashboard**
   - Establishment performance metrics
   - Offer success rates
   - Customer engagement tracking

7. **Geofencing**
   - Operating area boundaries
   - Delivery zones
   - Service area maps

8. **Internationalization**
   - Multi-language support for descriptions
   - Timezone-aware business hours
   - Currency handling

---

## References

- **NestJS Documentation:** https://docs.nestjs.com
- **Mongoose Geospatial:** https://mongoosejs.com/docs/geojson.html
- **MongoDB 2dsphere Index:** https://www.mongodb.com/docs/manual/core/2dsphere/
- **class-validator:** https://github.com/typestack/class-validator
- **Multer File Upload:** https://github.com/expressjs/multer

---

## Maintainers

For questions or issues related to the Establishments module, contact the backend team or refer to:

- Repository: C:\WFA\apps\food-waste-backend\src\establishments\
- Swagger Documentation: http://localhost:3000/api/v1/api-docs
- Module Tag: 🏪 Establishments Management

---

**Last Updated:** 2025-01-15
**Version:** 1.0.0
**API Version:** v1
