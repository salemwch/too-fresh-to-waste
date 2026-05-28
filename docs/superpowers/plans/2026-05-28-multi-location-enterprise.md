# Multi-Location Enterprise System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow enterprise merchants (Movenpick, Bonépi, hotel chains) to manage
multiple business locations from a single organization, with sub-accounts for
location managers who get their own login.

**Architecture:** New `Organization` collection links multiple `Establishment`
documents. Enterprise owners (role=`MERCHANT`) own the organization and can
invite Location Managers (new role=`LOCATION_MANAGER`) who each manage exactly
one assigned establishment. Solo merchants with one location remain completely
unaffected — `organizationId` is optional on Establishment.

**Tech Stack:** NestJS 11 + Mongoose (backend), Next.js 15 App Router +
Zustand + TanStack Query + shadcn/ui (web), `@foodwaste/shared`
(types/enums/schemas).

---

## Subsystem Breakdown

This plan is split into **5 subsystems**, each independently testable and
shippable:

1. **Shared Enums & Types** — New role, organization types in `packages/shared`
2. **Backend: Organization Module** — Schema, CRUD, invitation, guards
3. **Backend: Existing Module Patches** — Lift 1:1 enforcement, add org-aware
   authorization
4. **Web: Organization Dashboard** — Location switcher, org management,
   invitation UI
5. **Web: Existing Page Patches** — Establishment-scoped offers/orders/analytics

---

## File Structure

### packages/shared/src/

| File                              | Responsibility                                                 |
| --------------------------------- | -------------------------------------------------------------- |
| `enums/user.enum.ts`              | **Modify** — add `LOCATION_MANAGER` role                       |
| `enums/organization.enum.ts`      | **Create** — `OrganizationStatus`, `InvitationStatus` enums    |
| `enums/index.ts`                  | **Modify** — re-export new enums                               |
| `types/organization.types.ts`     | **Create** — `Organization`, `OrganizationInvitation` TS types |
| `types/index.ts`                  | **Modify** — re-export organization types                      |
| `schemas/organization.schemas.ts` | **Create** — Zod validation schemas for org operations         |
| `schemas/index.ts`                | **Modify** — re-export new schemas                             |

### apps/food-waste-backend/src/

| File                                                      | Responsibility                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **organizations/ (new module)**                           |                                                                                |
| `organizations/schemas/organization.schema.ts`            | Organization Mongoose schema + indexes                                         |
| `organizations/schemas/organization-invitation.schema.ts` | Invitation Mongoose schema + indexes                                           |
| `organizations/organizations.module.ts`                   | Module wiring                                                                  |
| `organizations/organizations.controller.ts`               | REST endpoints for org CRUD + invitations                                      |
| `organizations/organizations.service.ts`                  | Business logic: create org, add location, invite, remove                       |
| `organizations/organizations-invitation.service.ts`       | Invitation logic: create, accept, revoke                                       |
| `organizations/dto/create-organization.dto.ts`            | DTO for org creation                                                           |
| `organizations/dto/update-organization.dto.ts`            | DTO for org updates                                                            |
| `organizations/dto/invite-member.dto.ts`                  | DTO for sending invitation                                                     |
| `organizations/dto/accept-invitation.dto.ts`              | DTO for accepting invitation                                                   |
| `organizations/guards/organization-role.guard.ts`         | Guard: check org membership + role                                             |
| **Existing module patches**                               |                                                                                |
| `establishments/schemas/establishment.schema.ts`          | **Modify** — add `organizationId` field + index                                |
| `establishments/establishments.service.ts`                | **Modify** — lift 1:1 restriction for org owners, add `findByOrganizationId()` |
| `establishments/establishments.controller.ts`             | **Modify** — `getMyEstablishment` returns org establishments for org owners    |
| `offers/offers.controller.ts`                             | **Modify** — `getMyOffers` accepts `?establishmentId=` filter                  |
| `offers/offers.service.ts`                                | **Modify** — `findByMerchant` supports optional `establishmentId` filter       |
| `orders/order.controller.ts`                              | **Modify** — merchant order queries support `?establishmentId=` filter         |
| `auth/auth.service.ts`                                    | **Modify** — `register()` supports invitation-based signup                     |
| `auth/strategies/jwt.strategie.ts`                        | **Modify** — JWT payload adds `organizationId` + `assignedEstablishmentId`     |
| `common/decorators/get-user.decorator.ts`                 | **Modify** — `AuthUser` adds `organizationId?` + `assignedEstablishmentId?`    |
| `auth/guards/roles.guard.ts`                              | **Modify** — `LOCATION_MANAGER` inherits subset of `MERCHANT` permissions      |

### apps/web/src/

| File                                                             | Responsibility                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Organization management**                                      |                                                                                                  |
| `services/organization.service.ts`                               | **Create** — API client for org endpoints                                                        |
| `hooks/use-organization.ts`                                      | **Create** — TanStack Query hooks for org data                                                   |
| `components/dashboard/organization/location-switcher.tsx`        | **Create** — Dropdown to switch active establishment                                             |
| `components/dashboard/organization/org-locations-page.tsx`       | **Create** — List/add/remove locations                                                           |
| `components/dashboard/organization/invite-member-dialog.tsx`     | **Create** — Invitation form modal                                                               |
| `components/dashboard/organization/org-members-page.tsx`         | **Create** — Manage invited members                                                              |
| `components/dashboard/organization/org-settings-page.tsx`        | **Create** — Org name, logo, billing                                                             |
| `app/[locale]/(merchant)/merchant/organization/page.tsx`         | **Create** — Org management page                                                                 |
| `app/[locale]/(merchant)/merchant/organization/members/page.tsx` | **Create** — Members page                                                                        |
| `app/[locale]/(auth)/accept-invitation/page.tsx`                 | **Create** — Invitation acceptance flow                                                          |
| **Existing patches**                                             |                                                                                                  |
| `lib/auth.ts`                                                    | **Modify** — AuthStore adds `organizationId`, `assignedEstablishmentId`, `activeEstablishmentId` |
| `config/navigation.config.ts`                                    | **Modify** — add org nav items (conditional on org membership)                                   |
| `app/[locale]/(merchant)/merchant-layout-shell.tsx`              | **Modify** — render LocationSwitcher when user has org                                           |
| `components/guards/role-guard.tsx`                               | **Modify** — accept `LOCATION_MANAGER`                                                           |
| `hooks/use-merchant-dashboard.ts`                                | **Modify** — all queries include `establishmentId` parameter                                     |
| `services/dashboard.service.ts`                                  | **Modify** — pass `establishmentId` to API calls                                                 |

---

## Task 1: Shared Enums & Types

**Files:**

- Modify: `packages/shared/src/enums/user.enum.ts`
- Create: `packages/shared/src/enums/organization.enum.ts`
- Modify: `packages/shared/src/enums/index.ts`
- Create: `packages/shared/src/types/organization.types.ts`
- Modify: `packages/shared/src/types/index.ts`

- [ ] **Step 1: Add LOCATION_MANAGER to UserRole enum**

In `packages/shared/src/enums/user.enum.ts`, add the new role:

```typescript
export enum UserRole {
  CONSUMER = 'consumer',
  MERCHANT = 'merchant',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  DRIVER = 'driver',
  LOCATION_MANAGER = 'location_manager',
}
```

Rationale: `LOCATION_MANAGER` is a separate role (not `MERCHANT`) because they
have restricted permissions — they cannot create organizations, add locations,
or invite people.

- [ ] **Step 2: Create organization enums**

Create `packages/shared/src/enums/organization.enum.ts`:

```typescript
export enum OrganizationStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

export enum OrganizationRole {
  OWNER = 'owner',
  LOCATION_MANAGER = 'location_manager',
}

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}
```

- [ ] **Step 3: Export new enums from barrel**

In `packages/shared/src/enums/index.ts`, add:

```typescript
export {
  OrganizationStatus,
  OrganizationRole,
  InvitationStatus,
} from './organization.enum';
```

- [ ] **Step 4: Create organization types**

Create `packages/shared/src/types/organization.types.ts`:

```typescript
import type {
  OrganizationStatus,
  OrganizationRole,
  InvitationStatus,
} from '../enums';

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
```

- [ ] **Step 5: Export types from barrel**

In `packages/shared/src/types/index.ts`, add:

```typescript
export type {
  OrganizationType,
  OrganizationMember,
  OrganizationInvitation,
} from './organization.types';
```

- [ ] **Step 6: Build shared package and verify**

Run: `pnpm --filter @foodwaste/shared build`

Expected: Clean build with no errors. The new enums and types are now available
to all apps.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/enums/user.enum.ts packages/shared/src/enums/organization.enum.ts packages/shared/src/enums/index.ts packages/shared/src/types/organization.types.ts packages/shared/src/types/index.ts
git commit -m "feat(shared): add LOCATION_MANAGER role, organization enums and types"
```

---

## Task 2: Backend — Organization Schema & Module Setup

**Files:**

- Create:
  `apps/food-waste-backend/src/organizations/schemas/organization.schema.ts`
- Create:
  `apps/food-waste-backend/src/organizations/schemas/organization-invitation.schema.ts`
- Create: `apps/food-waste-backend/src/organizations/organizations.module.ts`
- Modify: `apps/food-waste-backend/src/app.module.ts`

- [ ] **Step 1: Create Organization schema**

Create
`apps/food-waste-backend/src/organizations/schemas/organization.schema.ts`:

```typescript
import { OrganizationStatus } from '@foodwaste/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrganizationDocument = Organization & Document;

@Schema({ timestamps: true })
export class Organization {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 100 })
  name!: string;

  @Prop({ type: String })
  logo?: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  ownerId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: OrganizationStatus,
    default: OrganizationStatus.PENDING,
  })
  status!: OrganizationStatus;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Establishment' }], default: [] })
  establishmentIds!: Types.ObjectId[];

  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}

export const OrganizationSchema = SchemaFactory.createForClass(Organization);

OrganizationSchema.index({ ownerId: 1 }, { unique: true });
OrganizationSchema.index({ status: 1 });
OrganizationSchema.index({ establishmentIds: 1 });
```

Key decisions:

- `ownerId` has a unique index — one org per owner (they remain a MERCHANT).
- `establishmentIds` is an array of ObjectIds — denormalized for fast lookups.

- [ ] **Step 2: Create OrganizationInvitation schema**

Create
`apps/food-waste-backend/src/organizations/schemas/organization-invitation.schema.ts`:

```typescript
import { InvitationStatus, OrganizationRole } from '@foodwaste/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrganizationInvitationDocument = OrganizationInvitation & Document;

@Schema({ timestamps: true })
export class OrganizationInvitation {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Organization' })
  organizationId!: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({
    type: String,
    enum: OrganizationRole,
    default: OrganizationRole.LOCATION_MANAGER,
  })
  role!: OrganizationRole;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Establishment' })
  assignedEstablishmentId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status!: InvitationStatus;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  invitedBy!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  token!: string;

  @Prop({ required: true, type: Date })
  expiresAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  acceptedBy?: Types.ObjectId;

  @Prop({ type: Date })
  acceptedAt?: Date;
}

export const OrganizationInvitationSchema = SchemaFactory.createForClass(
  OrganizationInvitation,
);

OrganizationInvitationSchema.index({ token: 1 }, { unique: true });
OrganizationInvitationSchema.index({ organizationId: 1, status: 1 });
OrganizationInvitationSchema.index({ email: 1, status: 1 });
OrganizationInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

Key decisions:

- `token` is unique — used in the invitation link URL.
- `expiresAt` TTL index — MongoDB auto-deletes expired invitations.
- `assignedEstablishmentId` is required — every location manager maps to exactly
  one establishment.

- [ ] **Step 3: Create module file (minimal — just schemas for now)**

Create `apps/food-waste-backend/src/organizations/organizations.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  Organization,
  OrganizationSchema,
} from './schemas/organization.schema';
import {
  OrganizationInvitation,
  OrganizationInvitationSchema,
} from './schemas/organization-invitation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      {
        name: OrganizationInvitation.name,
        schema: OrganizationInvitationSchema,
      },
    ]),
  ],
  exports: [MongooseModule],
})
export class OrganizationsModule {}
```

- [ ] **Step 4: Register module in AppModule**

In `apps/food-waste-backend/src/app.module.ts`, add to imports:

```typescript
import { OrganizationsModule } from './organizations/organizations.module';

// In @Module imports array, add:
OrganizationsModule,
```

- [ ] **Step 5: Verify backend compiles**

Run: `pnpm --filter @foodwaste/backend type-check`

Expected: No type errors. The new schemas are registered with Mongoose.

- [ ] **Step 6: Commit**

```bash
git add apps/food-waste-backend/src/organizations/ apps/food-waste-backend/src/app.module.ts
git commit -m "feat(backend): add Organization and OrganizationInvitation schemas"
```

---

## Task 3: Backend — Organization DTOs

**Files:**

- Create:
  `apps/food-waste-backend/src/organizations/dto/create-organization.dto.ts`
- Create:
  `apps/food-waste-backend/src/organizations/dto/update-organization.dto.ts`
- Create: `apps/food-waste-backend/src/organizations/dto/invite-member.dto.ts`
- Create:
  `apps/food-waste-backend/src/organizations/dto/accept-invitation.dto.ts`

- [ ] **Step 1: Create CreateOrganizationDto**

Create
`apps/food-waste-backend/src/organizations/dto/create-organization.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

import { SanitizeText } from '../../common/decorators/sanitize.decorator';

export class CreateOrganizationDto {
  @ApiProperty({
    description: 'Organization / brand name',
    example: 'Movenpick Tunisia',
    minLength: 2,
    maxLength: 100,
  })
  @SanitizeText()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}
```

- [ ] **Step 2: Create UpdateOrganizationDto**

Create
`apps/food-waste-backend/src/organizations/dto/update-organization.dto.ts`:

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

import { SanitizeText } from '../../common/decorators/sanitize.decorator';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ example: 'Movenpick Hotels & Resorts Tunisia' })
  @IsOptional()
  @SanitizeText()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;
}
```

Logo upload will be handled as a separate multipart endpoint (same pattern as
establishment images).

- [ ] **Step 3: Create InviteMemberDto**

Create `apps/food-waste-backend/src/organizations/dto/invite-member.dto.ts`:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsMongoId } from 'class-validator';

import { SanitizeEmail } from '../../common/decorators/sanitize.decorator';

export class InviteMemberDto {
  @ApiProperty({
    description: 'Email of the person to invite as location manager',
    example: 'receptionist@movenpick.tn',
  })
  @SanitizeEmail()
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Establishment ID to assign the manager to',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  assignedEstablishmentId!: string;
}
```

Role is always `LOCATION_MANAGER` — not configurable by the caller. Principle of
least privilege.

- [ ] **Step 4: Create AcceptInvitationDto**

Create `apps/food-waste-backend/src/organizations/dto/accept-invitation.dto.ts`:

```typescript
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_SPECIAL_CHARS,
  PASSWORD_ERROR_MESSAGES,
  buildPasswordRegex,
} from '@foodwaste/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';

import { SanitizeText } from '../../common/decorators/sanitize.decorator';

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Invitation token from the email link' })
  @IsString()
  token!: string;

  @ApiProperty({ description: 'First name of the new location manager' })
  @SanitizeText()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @ApiProperty({ description: 'Last name of the new location manager' })
  @SanitizeText()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName!: string;

  @ApiProperty({
    description: `Password (NIST 800-63B). ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} chars, uppercase + lowercase + number + special (${PASSWORD_SPECIAL_CHARS})`,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: PASSWORD_ERROR_MESSAGES.TOO_SHORT,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, { message: PASSWORD_ERROR_MESSAGES.TOO_LONG })
  @Matches(buildPasswordRegex(), {
    message: `Password must contain uppercase, lowercase, number, and special character (${PASSWORD_SPECIAL_CHARS})`,
  })
  password!: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
```

- [ ] **Step 5: Verify backend compiles**

Run: `pnpm --filter @foodwaste/backend type-check`

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/food-waste-backend/src/organizations/dto/
git commit -m "feat(backend): add organization DTOs (create, update, invite, accept)"
```

---

## Task 4: Backend — Organization Service

**Files:**

- Create: `apps/food-waste-backend/src/organizations/organizations.service.ts`
- Create:
  `apps/food-waste-backend/src/organizations/organizations-invitation.service.ts`

- [ ] **Step 1: Create OrganizationsService**

Create `apps/food-waste-backend/src/organizations/organizations.service.ts`:

```typescript
import { OrganizationStatus } from '@foodwaste/shared';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  Organization,
  OrganizationDocument,
} from './schemas/organization.schema';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @InjectModel(Organization.name)
    private readonly organizationModel: Model<OrganizationDocument>,
  ) {}

  async create(
    dto: CreateOrganizationDto,
    ownerId: string,
    firstEstablishmentId: string,
  ): Promise<OrganizationDocument> {
    const existing = await this.organizationModel.findOne({
      ownerId: new Types.ObjectId(ownerId),
      isDeleted: { $ne: true },
    });
    if (existing) {
      throw new ConflictException('You already have an organization');
    }

    const org = new this.organizationModel({
      name: dto.name,
      ownerId: new Types.ObjectId(ownerId),
      status: OrganizationStatus.PENDING,
      establishmentIds: [new Types.ObjectId(firstEstablishmentId)],
    });

    const saved = await org.save();
    this.logger.log(`Organization created: ${saved._id} by owner ${ownerId}`);
    return saved;
  }

  async findById(id: string): Promise<OrganizationDocument> {
    const org = await this.organizationModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: { $ne: true },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  async findByOwnerId(ownerId: string): Promise<OrganizationDocument | null> {
    return this.organizationModel.findOne({
      ownerId: new Types.ObjectId(ownerId),
      isDeleted: { $ne: true },
    });
  }

  async findByEstablishmentId(
    establishmentId: string,
  ): Promise<OrganizationDocument | null> {
    return this.organizationModel.findOne({
      establishmentIds: new Types.ObjectId(establishmentId),
      isDeleted: { $ne: true },
    });
  }

  async update(
    id: string,
    dto: UpdateOrganizationDto,
    userId: string,
  ): Promise<OrganizationDocument> {
    const org = await this.findById(id);
    if (org.ownerId.toString() !== userId) {
      throw new ForbiddenException('Only the organization owner can update it');
    }

    Object.assign(org, dto);
    return org.save();
  }

  async addEstablishment(
    orgId: string,
    establishmentId: string,
    userId: string,
  ): Promise<OrganizationDocument> {
    const org = await this.findById(orgId);
    if (org.ownerId.toString() !== userId) {
      throw new ForbiddenException(
        'Only the organization owner can add locations',
      );
    }

    const estabOid = new Types.ObjectId(establishmentId);
    if (org.establishmentIds.some(id => id.equals(estabOid))) {
      throw new ConflictException(
        'Establishment already belongs to this organization',
      );
    }

    org.establishmentIds.push(estabOid);
    return org.save();
  }

  async removeEstablishment(
    orgId: string,
    establishmentId: string,
    userId: string,
    userModel: Model<any>,
  ): Promise<OrganizationDocument> {
    const org = await this.findById(orgId);
    if (org.ownerId.toString() !== userId) {
      throw new ForbiddenException(
        'Only the organization owner can remove locations',
      );
    }

    if (org.establishmentIds.length <= 1) {
      throw new ConflictException(
        'Organization must have at least one location',
      );
    }

    const estabOid = new Types.ObjectId(establishmentId);
    org.establishmentIds = org.establishmentIds.filter(
      id => !id.equals(estabOid),
    );
    const saved = await org.save();

    // CASCADE: Suspend any location managers assigned to this establishment
    // They can be reassigned later — not deleted, just suspended.
    await userModel.updateMany(
      {
        assignedEstablishmentId: estabOid,
        role: 'location_manager',
        status: { $ne: 'suspended' },
      },
      {
        $set: { status: 'suspended' },
      },
    );
    this.logger.warn(
      `Suspended location managers for removed establishment ${establishmentId} in org ${orgId}`,
    );

    return saved;
  }

  async updateStatus(
    id: string,
    status: OrganizationStatus,
  ): Promise<OrganizationDocument> {
    const org = await this.findById(id);
    org.status = status;
    return org.save();
  }
}
```

- [ ] **Step 2: Create OrganizationsInvitationService**

Create
`apps/food-waste-backend/src/organizations/organizations-invitation.service.ts`:

```typescript
import {
  InvitationStatus,
  OrganizationRole,
  UserRole,
  UserStatus,
} from '@foodwaste/shared';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';

import { EmailService } from '../email/email.service';
import { UsersService } from '../users/user.service';

import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { OrganizationsService } from './organizations.service';
import {
  OrganizationInvitation,
  OrganizationInvitationDocument,
} from './schemas/organization-invitation.schema';

const INVITATION_EXPIRY_DAYS = 7;

@Injectable()
export class OrganizationsInvitationService {
  private readonly logger = new Logger(OrganizationsInvitationService.name);

  constructor(
    @InjectModel(OrganizationInvitation.name)
    private readonly invitationModel: Model<OrganizationInvitationDocument>,
    private readonly organizationsService: OrganizationsService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  async invite(
    orgId: string,
    dto: InviteMemberDto,
    invitedByUserId: string,
  ): Promise<OrganizationInvitationDocument> {
    const org = await this.organizationsService.findById(orgId);
    if (org.ownerId.toString() !== invitedByUserId) {
      throw new ForbiddenException(
        'Only the organization owner can invite members',
      );
    }

    const estabOid = new Types.ObjectId(dto.assignedEstablishmentId);
    if (!org.establishmentIds.some(id => id.equals(estabOid))) {
      throw new BadRequestException(
        'Establishment does not belong to this organization',
      );
    }

    const existingPending = await this.invitationModel.findOne({
      organizationId: org._id,
      email: dto.email.toLowerCase(),
      status: InvitationStatus.PENDING,
    });
    if (existingPending) {
      throw new ConflictException(
        'An invitation is already pending for this email',
      );
    }

    const existingUser = await this.usersService
      .findByEmail(dto.email)
      .catch(() => null);
    if (existingUser) {
      throw new ConflictException(
        'A user with this email already exists. They must use a different email.',
      );
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

    const invitation = new this.invitationModel({
      organizationId: org._id,
      email: dto.email.toLowerCase(),
      role: OrganizationRole.LOCATION_MANAGER,
      assignedEstablishmentId: estabOid,
      status: InvitationStatus.PENDING,
      invitedBy: new Types.ObjectId(invitedByUserId),
      token,
      expiresAt,
    });

    const saved = await invitation.save();
    this.logger.log(`Invitation sent to ${dto.email} for org ${orgId}`);

    this.sendInvitationEmail(dto.email, org.name, token).catch(err =>
      this.logger.error(
        `Failed to send invitation email to ${dto.email}:`,
        err,
      ),
    );

    return saved;
  }

  async accept(
    dto: AcceptInvitationDto,
  ): Promise<{ userId: string; organizationId: string }> {
    const invitation = await this.invitationModel.findOne({
      token: dto.token,
      status: InvitationStatus.PENDING,
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or already used');
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = InvitationStatus.EXPIRED;
      await invitation.save();
      throw new BadRequestException('Invitation has expired');
    }

    const hashedPassword = await argon2.hash(dto.password);

    const user = await this.usersService.createLocationManager({
      email: invitation.email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: UserRole.LOCATION_MANAGER,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      organizationId: invitation.organizationId.toString(),
      assignedEstablishmentId: invitation.assignedEstablishmentId.toString(),
      ...(dto.phoneNumber ? { phoneNumber: dto.phoneNumber } : {}),
    });

    invitation.status = InvitationStatus.ACCEPTED;
    invitation.acceptedBy = new Types.ObjectId(user._id.toString());
    invitation.acceptedAt = new Date();
    await invitation.save();

    this.logger.log(
      `Invitation accepted by ${invitation.email}, user ${user._id} → org ${invitation.organizationId}`,
    );

    return {
      userId: user._id.toString(),
      organizationId: invitation.organizationId.toString(),
    };
  }

  async findByOrganization(
    orgId: string,
    userId: string,
  ): Promise<OrganizationInvitationDocument[]> {
    const org = await this.organizationsService.findById(orgId);
    if (org.ownerId.toString() !== userId) {
      throw new ForbiddenException(
        'Only the organization owner can view invitations',
      );
    }

    return this.invitationModel
      .find({ organizationId: org._id })
      .sort({ createdAt: -1 })
      .lean();
  }

  async revoke(invitationId: string, userId: string): Promise<void> {
    const invitation = await this.invitationModel.findById(invitationId);
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    const org = await this.organizationsService.findById(
      invitation.organizationId.toString(),
    );
    if (org.ownerId.toString() !== userId) {
      throw new ForbiddenException(
        'Only the organization owner can revoke invitations',
      );
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Only pending invitations can be revoked');
    }

    invitation.status = InvitationStatus.REVOKED;
    await invitation.save();
  }

  async getByToken(token: string): Promise<OrganizationInvitationDocument> {
    const invitation = await this.invitationModel
      .findOne({ token, status: InvitationStatus.PENDING })
      .populate('organizationId', 'name')
      .populate('assignedEstablishmentId', 'name address.city');

    if (!invitation) {
      throw new NotFoundException(
        'Invitation not found, expired, or already used',
      );
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = InvitationStatus.EXPIRED;
      await invitation.save();
      throw new BadRequestException('Invitation has expired');
    }

    return invitation;
  }

  private async sendInvitationEmail(
    email: string,
    orgName: string,
    token: string,
  ): Promise<void> {
    const frontendUrl =
      process.env['FRONTEND_URL'] ?? 'https://toofreshtowaste.com';
    const inviteUrl = `${frontendUrl}/en/accept-invitation?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:Arial,sans-serif;background:#f9f3f0;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
          <div style="background:#1E4448;padding:28px 32px;">
            <p style="color:rgba(255,255,255,0.6);font-size:11px;text-transform:uppercase;letter-spacing:0.2em;margin:0 0 6px;">Too Fresh To Waste</p>
            <h1 style="color:#fff;font-size:22px;margin:0;">You're Invited!</h1>
          </div>
          <div style="padding:32px;">
            <p style="font-size:16px;color:#333;">
              <strong>${orgName}</strong> has invited you to manage one of their locations on Too Fresh To Waste.
            </p>
            <p style="font-size:14px;color:#666;margin:16px 0;">
              Click the button below to create your account and start managing your location.
            </p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${inviteUrl}" style="display:inline-block;background:#1E4448;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
                Accept Invitation
              </a>
            </div>
            <p style="font-size:12px;color:#999;margin-top:24px;">
              This invitation expires in ${INVITATION_EXPIRY_DAYS} days. If you didn't expect this, ignore this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.emailService.sendEmail({
      to: email,
      subject: `${orgName} invited you to Too Fresh To Waste`,
      html,
      text: `${orgName} invited you to manage a location on Too Fresh To Waste. Accept: ${inviteUrl}`,
    });
  }
}
```

- [ ] **Step 3: Verify backend compiles**

Run: `pnpm --filter @foodwaste/backend type-check`

This step will fail because `UsersService.createLocationManager()` and
`UsersService.findByEmail()` may not match perfectly yet. That's expected —
we'll patch those in Task 6. For now, focus on getting the service logic correct
and then comment out the failing references temporarily, or proceed to Task 5
first.

- [ ] **Step 4: Commit**

```bash
git add apps/food-waste-backend/src/organizations/organizations.service.ts apps/food-waste-backend/src/organizations/organizations-invitation.service.ts
git commit -m "feat(backend): add OrganizationsService and invitation service"
```

---

## Task 5: Backend — Organization Controller

**Files:**

- Create:
  `apps/food-waste-backend/src/organizations/organizations.controller.ts`
- Modify: `apps/food-waste-backend/src/organizations/organizations.module.ts`

- [ ] **Step 1: Create OrganizationsController**

Create `apps/food-waste-backend/src/organizations/organizations.controller.ts`:

```typescript
import { OrganizationStatus, UserRole } from '@foodwaste/shared';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedRequest } from '../common/decorators/get-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsInvitationService } from './organizations-invitation.service';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly invitationService: OrganizationsInvitationService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an organization (enterprise upgrade)' })
  async create(
    @Body() dto: CreateOrganizationDto,
    @Body('establishmentId') establishmentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const org = await this.organizationsService.create(
      dto,
      req.user.userId,
      establishmentId,
    );
    return {
      message: 'Organization created successfully. Pending admin approval.',
      data: org,
    };
  }

  @Get('my-organization')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
  @ApiOperation({ summary: "Get the current user's organization" })
  async getMyOrganization(@Request() req: AuthenticatedRequest) {
    const org = await this.organizationsService.findByOwnerId(req.user.userId);
    return {
      message: org ? 'Organization retrieved' : 'No organization found',
      data: org,
    };
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.ADMIN)
  async findById(@Param('id') id: string) {
    const org = await this.organizationsService.findById(id);
    return { message: 'Organization retrieved', data: org };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const org = await this.organizationsService.update(
      id,
      dto,
      req.user.userId,
    );
    return { message: 'Organization updated', data: org };
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: approve or suspend organization' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: OrganizationStatus,
  ) {
    const org = await this.organizationsService.updateStatus(id, status);
    return { message: `Organization status updated to ${status}`, data: org };
  }

  @Post(':id/establishments/:establishmentId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @ApiOperation({
    summary: 'Add an existing establishment to the organization',
  })
  async addEstablishment(
    @Param('id') id: string,
    @Param('establishmentId') establishmentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const org = await this.organizationsService.addEstablishment(
      id,
      establishmentId,
      req.user.userId,
    );
    return { message: 'Location added to organization', data: org };
  }

  @Delete(':id/establishments/:establishmentId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @ApiOperation({ summary: 'Remove an establishment from the organization' })
  async removeEstablishment(
    @Param('id') id: string,
    @Param('establishmentId') establishmentId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const org = await this.organizationsService.removeEstablishment(
      id,
      establishmentId,
      req.user.userId,
    );
    return { message: 'Location removed from organization', data: org };
  }

  // ─── Invitations ────────────────────────────────────────────────────────

  @Post(':id/invitations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a location manager' })
  async invite(
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const invitation = await this.invitationService.invite(
      id,
      dto,
      req.user.userId,
    );
    return { message: 'Invitation sent', data: invitation };
  }

  @Get(':id/invitations')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @ApiOperation({ summary: 'List invitations for the organization' })
  async listInvitations(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const invitations = await this.invitationService.findByOrganization(
      id,
      req.user.userId,
    );
    return { message: 'Invitations retrieved', data: invitations };
  }

  @Delete('invitations/:invitationId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @ApiOperation({ summary: 'Revoke a pending invitation' })
  async revokeInvitation(
    @Param('invitationId') invitationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.invitationService.revoke(invitationId, req.user.userId);
    return { message: 'Invitation revoked' };
  }

  // ─── Public invitation endpoints ────────────────────────────────────────

  @Get('invitations/verify/:token')
  @Public()
  @ApiOperation({ summary: 'Verify an invitation token (public)' })
  async verifyInvitation(@Param('token') token: string) {
    const invitation = await this.invitationService.getByToken(token);
    return {
      message: 'Invitation is valid',
      data: {
        email: invitation.email,
        organizationName: (
          invitation.organizationId as unknown as { name: string }
        ).name,
        establishmentName: (
          invitation.assignedEstablishmentId as unknown as { name: string }
        ).name,
        expiresAt: invitation.expiresAt,
      },
    };
  }

  @Post('invitations/accept')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Accept an invitation and create account (public)' })
  async acceptInvitation(@Body() dto: AcceptInvitationDto) {
    const result = await this.invitationService.accept(dto);
    return {
      message: 'Account created successfully. You can now log in.',
      data: result,
    };
  }
}
```

- [ ] **Step 2: Update module with controller, services, and dependencies**

Replace `apps/food-waste-backend/src/organizations/organizations.module.ts`:

```typescript
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common/common.module';
import { EmailModule } from '../email/email.module';
import { UserModule } from '../users/user.module';

import { OrganizationsController } from './organizations.controller';
import { OrganizationsInvitationService } from './organizations-invitation.service';
import { OrganizationsService } from './organizations.service';
import {
  Organization,
  OrganizationSchema,
} from './schemas/organization.schema';
import {
  OrganizationInvitation,
  OrganizationInvitationSchema,
} from './schemas/organization-invitation.schema';

@Module({
  imports: [
    CommonModule,
    EmailModule,
    forwardRef(() => UserModule),
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      {
        name: OrganizationInvitation.name,
        schema: OrganizationInvitationSchema,
      },
    ]),
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationsInvitationService],
  exports: [
    OrganizationsService,
    OrganizationsInvitationService,
    MongooseModule,
  ],
})
export class OrganizationsModule {}
```

- [ ] **Step 3: Verify backend compiles**

Run: `pnpm --filter @foodwaste/backend type-check`

Expected: May still have errors from `UsersService.createLocationManager()` —
addressed in next task.

- [ ] **Step 4: Commit**

```bash
git add apps/food-waste-backend/src/organizations/
git commit -m "feat(backend): add organization controller and wire module"
```

---

## Task 6: Backend — Patch Existing Modules for Multi-Location

**Files:**

- Modify:
  `apps/food-waste-backend/src/establishments/schemas/establishment.schema.ts`
- Modify: `apps/food-waste-backend/src/establishments/establishments.service.ts`
- Modify: `apps/food-waste-backend/src/users/user.service.ts`
- Modify: `apps/food-waste-backend/src/users/schemas/user.schema.ts`
- Modify: `apps/food-waste-backend/src/auth/strategies/jwt.strategie.ts`
- Modify: `apps/food-waste-backend/src/common/decorators/get-user.decorator.ts`
- Modify: `apps/food-waste-backend/src/auth/guards/roles.guard.ts`

- [ ] **Step 1: Add organizationId to Establishment schema**

In `apps/food-waste-backend/src/establishments/schemas/establishment.schema.ts`,
add after the `ownerId` field (around line 96):

```typescript
  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId;
```

Add index after existing indexes (after the soft delete index around line 550):

```typescript
EstablishmentSchema.index({ organizationId: 1 }, { sparse: true });
```

- [ ] **Step 2: Add organizationId and assignedEstablishmentId to User schema**

In `apps/food-waste-backend/src/users/schemas/user.schema.ts`, add after the
`role` field (around line 74):

```typescript
  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Establishment' })
  assignedEstablishmentId?: Types.ObjectId;
```

Add index:

```typescript
UserSchema.index({ organizationId: 1 }, { sparse: true });
```

- [ ] **Step 3: Add createLocationManager to UsersService**

In `apps/food-waste-backend/src/users/user.service.ts`, add a new method to the
`UsersService` class. Find where other `create` methods are and add:

```typescript
  async createLocationManager(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    status: UserStatus;
    isEmailVerified: boolean;
    organizationId: string;
    assignedEstablishmentId: string;
    phoneNumber?: string;
  }): Promise<UserDocument> {
    const user = new this.userModel({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      status: data.status,
      isEmailVerified: data.isEmailVerified,
      organizationId: new Types.ObjectId(data.organizationId),
      assignedEstablishmentId: new Types.ObjectId(data.assignedEstablishmentId),
      ...(data.phoneNumber ? { phoneNumber: data.phoneNumber } : {}),
    });
    return user.save();
  }
```

Note: The password is already hashed by
`OrganizationsInvitationService.accept()` before calling this method — do NOT
hash again.

- [ ] **Step 4: Lift 1:1 establishment restriction for org owners**

In `apps/food-waste-backend/src/establishments/establishments.service.ts`,
modify the `create()` method (around line 73-79). Replace the conflict check:

```typescript
  async create(
    createEstablishmentDto: CreateEstablishmentDto,
    ownerId: string,
  ): Promise<EstablishmentDocument> {
    // Solo merchants (no org) still limited to 1 establishment.
    // Org owners can create multiple — the org service manages the list.
    const org = await this.establishmentModel.db
      .collection('organizations')
      .findOne({ ownerId: new Types.ObjectId(ownerId), isDeleted: { $ne: true } });

    if (!org) {
      const existingEstablishment = await this.establishmentModel.findOne({ ownerId });
      if (existingEstablishment) {
        throw new ConflictException('User already has an establishment. Create an organization to add more locations.');
      }
    }

    const establishment = new this.establishmentModel({
      ...createEstablishmentDto,
      ownerId: new Types.ObjectId(ownerId),
      ...(org ? { organizationId: org._id } : {}),
    });

    const savedEstablishment = await establishment.save();
    // ... rest of event emission stays the same
```

- [ ] **Step 5: Add findByOrganizationId to EstablishmentsService**

Add a new method to `EstablishmentsService`:

```typescript
  async findByOrganizationId(
    organizationId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<FindAllResult> {
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const query = { organizationId: new Types.ObjectId(organizationId) };

    const [establishments, total] = await Promise.all([
      this.establishmentModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      this.establishmentModel.countDocuments(query),
    ]);

    return { establishments, total };
  }
```

- [ ] **Step 6: Update JWT payload to include org context**

In `apps/food-waste-backend/src/auth/strategies/jwt.strategie.ts`, update the
`JwtPayload` interface and `validate()`:

```typescript
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  organizationId?: string;
  assignedEstablishmentId?: string;
  iat?: number;
  exp?: number;
}
```

Update `validate()` to pass through the new fields:

```typescript
  async validate(payload: JwtPayload) {
    const user = await this.usersService.findByEmail(payload.email);

    if (user?.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      ...(payload.organizationId ? { organizationId: payload.organizationId } : {}),
      ...(payload.assignedEstablishmentId
        ? { assignedEstablishmentId: payload.assignedEstablishmentId }
        : {}),
    };
  }
```

You also need to update where the JWT is **signed** (in `auth.service.ts` or
`token.service.ts`) to include `organizationId` and `assignedEstablishmentId`
from the user document when generating access tokens. Find the `sign()` /
`generateTokens()` call and add:

```typescript
// In the payload passed to jwtService.sign():
const payload = {
  sub: user._id.toString(),
  email: user.email,
  role: user.role,
  ...(user.organizationId
    ? { organizationId: user.organizationId.toString() }
    : {}),
  ...(user.assignedEstablishmentId
    ? { assignedEstablishmentId: user.assignedEstablishmentId.toString() }
    : {}),
};
```

- [ ] **Step 7: Update AuthUser interface**

In `apps/food-waste-backend/src/common/decorators/get-user.decorator.ts`,
update:

```typescript
export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  assignedEstablishmentId?: string;
}
```

- [ ] **Step 8: Update RolesGuard to accept LOCATION_MANAGER**

In `apps/food-waste-backend/src/auth/guards/roles.guard.ts`, ensure
`LOCATION_MANAGER` is recognized. The guard checks
`requiredRoles.some(role => role === user.role)` — as long as controllers use
`@Roles(UserRole.MERCHANT, UserRole.LOCATION_MANAGER)`, it works. No code change
needed in the guard itself, but verify the guard logic doesn't reject unknown
roles.

- [ ] **Step 9: Verify backend compiles**

Run: `pnpm --filter @foodwaste/backend type-check`

Expected: Clean compilation.

- [ ] **Step 10: Commit**

```bash
git add apps/food-waste-backend/src/establishments/ apps/food-waste-backend/src/users/ apps/food-waste-backend/src/auth/ apps/food-waste-backend/src/common/
git commit -m "feat(backend): patch existing modules for multi-location support

- Add organizationId to Establishment and User schemas
- Lift 1:1 establishment restriction for org owners
- Add createLocationManager to UsersService
- Extend JWT payload with org context
- Add findByOrganizationId to EstablishmentsService"
```

---

## Task 7: Backend — Patch Offers & Orders for Establishment Filtering

**Files:**

- Modify: `apps/food-waste-backend/src/offers/offers.controller.ts`
- Modify: `apps/food-waste-backend/src/orders/order.controller.ts` (verify file
  name)

- [ ] **Step 1: Add establishmentId filter to getMyOffers**

In `apps/food-waste-backend/src/offers/offers.controller.ts`, modify the
`getMyOffers()` endpoint (around line 418) to accept an optional
`establishmentId` query param:

```typescript
  @Get('my-offers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MERCHANT, UserRole.LOCATION_MANAGER)
  @ApiQuery({
    name: 'status',
    required: false,
    enum: OfferStatus,
  })
  @ApiQuery({
    name: 'establishmentId',
    required: false,
    description: 'Filter offers by establishment (for multi-location merchants)',
  })
  async getMyOffers(
    @GetUser() user: SafeUserResponse,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: OfferStatus,
    @Query('establishmentId') establishmentId?: string,
  ) {
    // Location managers can only see their assigned establishment
    const effectiveEstablishmentId =
      user.role === UserRole.LOCATION_MANAGER
        ? (user as unknown as { assignedEstablishmentId?: string }).assignedEstablishmentId
        : establishmentId;

    const result = await this.offersService.findByMerchant(
      user.userId,
      page,
      limit,
      user.userId,
      status,
      effectiveEstablishmentId,
    );

    return {
      message: 'Your offers retrieved successfully',
      data: result.data,
      meta: QueryOptimizer.getPaginationMeta(result.total, page, limit),
    };
  }
```

Then update `OffersService.findByMerchant()` to accept and use
`establishmentId`:

In `apps/food-waste-backend/src/offers/offers.service.ts`, find the
`findByMerchant` method and add the optional parameter:

```typescript
  async findByMerchant(
    merchantId: string,
    page: number = 1,
    limit: number = 10,
    userId: string,
    status?: OfferStatus,
    establishmentId?: string,
  ) {
    const filters: SearchOffersDto = {
      merchantId,
      page,
      limit,
      ...(status ? { status } : {}),
      ...(establishmentId ? { establishmentId } : {}),
    };
    // ...rest stays the same
```

Also verify that `SearchOffersDto` has an `establishmentId` field. If not, add
it.

- [ ] **Step 2: Add establishmentId filter to merchant orders**

Apply the same pattern to the orders controller. Find the merchant orders
endpoint and add `?establishmentId=` query parameter with the same
location-manager enforcement logic.

- [ ] **Step 3: Verify backend compiles**

Run: `pnpm --filter @foodwaste/backend type-check`

- [ ] **Step 4: Commit**

```bash
git add apps/food-waste-backend/src/offers/ apps/food-waste-backend/src/orders/
git commit -m "feat(backend): add establishmentId filter to offers and orders endpoints"
```

---

## Task 8: Web — Organization Service & Hooks

**Files:**

- Create: `apps/web/src/services/organization.service.ts`
- Create: `apps/web/src/hooks/use-organization.ts`

- [ ] **Step 1: Create organization API service**

Create `apps/web/src/services/organization.service.ts`:

```typescript
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
    return apiClient.get<BackendEnvelope<OrganizationResponse | null>>(
      `${BASE}/my-organization`,
    );
  },

  create(data: { name: string; establishmentId: string }) {
    return apiClient.post<BackendEnvelope<OrganizationResponse>>(BASE, data);
  },

  update(id: string, data: { name?: string }) {
    return apiClient.patch<BackendEnvelope<OrganizationResponse>>(
      `${BASE}/${id}`,
      data,
    );
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

  invite(
    orgId: string,
    data: { email: string; assignedEstablishmentId: string },
  ) {
    return apiClient.post<BackendEnvelope<InvitationResponse>>(
      `${BASE}/${orgId}/invitations`,
      data,
    );
  },

  listInvitations(orgId: string) {
    return apiClient.get<BackendEnvelope<InvitationResponse[]>>(
      `${BASE}/${orgId}/invitations`,
    );
  },

  revokeInvitation(invitationId: string) {
    return apiClient.delete<BackendEnvelope<void>>(
      `${BASE}/invitations/${invitationId}`,
    );
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
    return apiClient.post<
      BackendEnvelope<{ userId: string; organizationId: string }>
    >(`${BASE}/invitations/accept`, data);
  },
};
```

- [ ] **Step 2: Create organization hooks**

Create `apps/web/src/hooks/use-organization.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  organizationService,
  type OrganizationResponse,
  type InvitationResponse,
} from '@/services/organization.service';

export const organizationKeys = {
  all: ['organization'] as const,
  mine: () => [...organizationKeys.all, 'mine'] as const,
  invitations: (orgId: string) =>
    [...organizationKeys.all, 'invitations', orgId] as const,
};

export function useMyOrganization() {
  return useQuery({
    queryKey: organizationKeys.mine(),
    queryFn: async () => {
      const response = await organizationService.getMyOrganization();
      return response.data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; establishmentId: string }) =>
      organizationService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.mine() });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string } }) =>
      organizationService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.mine() });
    },
  });
}

export function useInviteMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; assignedEstablishmentId: string }) =>
      organizationService.invite(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationKeys.invitations(orgId),
      });
    },
  });
}

export function useOrganizationInvitations(orgId: string) {
  return useQuery({
    queryKey: organizationKeys.invitations(orgId),
    queryFn: async () => {
      const response = await organizationService.listInvitations(orgId);
      return response.data.data;
    },
    enabled: !!orgId,
  });
}

export function useRevokeInvitation(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      organizationService.revokeInvitation(invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: organizationKeys.invitations(orgId),
      });
    },
  });
}
```

- [ ] **Step 3: Verify web compiles**

Run: `pnpm --filter @foodwaste/web type-check`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/services/organization.service.ts apps/web/src/hooks/use-organization.ts
git commit -m "feat(web): add organization API service and TanStack Query hooks"
```

---

## Task 9: Web — Auth Store & Location Switcher

**Files:**

- Modify: `apps/web/src/lib/auth.ts`
- Create: `apps/web/src/components/dashboard/organization/location-switcher.tsx`

- [ ] **Step 1: Extend auth store with organization context**

In `apps/web/src/lib/auth.ts`, extend the `AuthState` interface:

```typescript
interface AuthState {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingOut: boolean;
  activeEstablishmentId: string | null;
}

interface AuthActions {
  setUser: (user: UserResponse | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  logout: () => void;
  setActiveEstablishmentId: (id: string | null) => void;
}
```

Add `activeEstablishmentId: null` to the initial state and add the setter:

```typescript
  activeEstablishmentId: null,
  setActiveEstablishmentId: id => set({ activeEstablishmentId: id }),
```

The `UserResponse` type from `@foodwaste/shared` will need to include
`organizationId?` and `assignedEstablishmentId?` — verify that the `/auth/me`
endpoint returns these fields. If `UserResponse` is auto-generated from OpenAPI,
regenerate types after the backend changes. Otherwise, extend it manually in the
shared types.

- [ ] **Step 2: Create LocationSwitcher component**

Create `apps/web/src/components/dashboard/organization/location-switcher.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { MapPin, ChevronDown, Building2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/lib/auth';
import { useMyEstablishment } from '@/hooks/use-merchant-dashboard';
import { useMyOrganization } from '@/hooks/use-organization';
import type { MyEstablishment } from '@/types/dashboard';

export function LocationSwitcher() {
  const { user, activeEstablishmentId, setActiveEstablishmentId } =
    useAuthStore();
  const { data: org } = useMyOrganization();
  const { data: establishment } = useMyEstablishment();

  // For org owners: fetch all org establishments
  // For location managers: only their assigned establishment
  // For solo merchants: single establishment, no switcher shown

  const isOrgOwner = !!org && org.ownerId === user?.userId;
  const isLocationManager = user?.role === 'location_manager';

  // Solo merchant or location manager with 1 location — don't render
  if (!org && !isLocationManager) return null;
  if (isLocationManager) return null; // they only see 1 location, no need for switcher

  // If establishments aren't loaded yet, show nothing
  if (!establishment) return null;

  // For org owners, we need all establishments from the org
  // The establishment hook returns the owner's establishments
  const establishments: MyEstablishment[] = Array.isArray(establishment)
    ? establishment
    : [establishment];

  if (establishments.length <= 1) return null;

  return (
    <div className='px-3 py-2'>
      <Select
        value={activeEstablishmentId ?? establishments[0]?._id ?? ''}
        onValueChange={setActiveEstablishmentId}
      >
        <SelectTrigger className='w-full bg-primary-500/10 border-primary-500/20 text-sm'>
          <div className='flex items-center gap-2 truncate'>
            <MapPin className='size-4 shrink-0 text-primary' />
            <SelectValue placeholder='Select location' />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>
            <div className='flex items-center gap-2'>
              <Building2 className='size-4' />
              All Locations
            </div>
          </SelectItem>
          {establishments.map(est => (
            <SelectItem key={est._id} value={est._id}>
              <div className='flex flex-col'>
                <span className='font-medium'>{est.name}</span>
                <span className='text-xs text-muted-foreground'>
                  {est.address?.city}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 3: Verify web compiles**

Run: `pnpm --filter @foodwaste/web type-check`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/auth.ts apps/web/src/components/dashboard/organization/
git commit -m "feat(web): add organization state to auth store and LocationSwitcher component"
```

---

## Task 10: Web — Merchant Layout Integration & Navigation

**Files:**

- Modify: `apps/web/src/app/[locale]/(merchant)/merchant-layout-shell.tsx`
- Modify: `apps/web/src/config/navigation.config.ts`
- Modify: `apps/web/src/components/guards/role-guard.tsx`

- [ ] **Step 1: Add LocationSwitcher to merchant layout**

In `apps/web/src/app/[locale]/(merchant)/merchant-layout-shell.tsx`, import and
render the switcher inside the sidebar area. Add after the `<Sidebar>` import:

```typescript
import { LocationSwitcher } from '@/components/dashboard/organization/location-switcher';
```

Render `<LocationSwitcher />` above `{children}` inside the main content area
(after `<TrialStatusBanner />`):

```tsx
<div className='mb-[16px]'>
  <TrialStatusBanner />
</div>
<LocationSwitcher />
{children}
```

- [ ] **Step 2: Add organization nav items**

In `apps/web/src/config/navigation.config.ts`, add to `merchantNavItems`:

```typescript
  {
    titleKey: 'organization',
    href: '/merchant/organization',
    icon: Building2,
    roles: [UserRole.MERCHANT],
  },
```

Add it after the `establishment` item. This page will only be visible to
merchants who have an organization — we'll conditionally render it in the
sidebar based on the org data.

- [ ] **Step 3: Update RoleGuard to accept LOCATION_MANAGER**

In `apps/web/src/components/guards/role-guard.tsx`, the guard already works with
any `UserRole` value since it does `allowedRoles.includes(user.role)`. Just
ensure `LOCATION_MANAGER` is in the `UserRole` enum re-exported by shared (done
in Task 1). No code change needed here — just verify.

Update the `MerchantLayoutShell` to also allow `LOCATION_MANAGER`:

```tsx
<RoleGuard allowedRoles={[UserRole.MERCHANT, UserRole.LOCATION_MANAGER]}>
```

- [ ] **Step 4: Verify web compiles**

Run: `pnpm --filter @foodwaste/web type-check`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/(merchant)/merchant-layout-shell.tsx apps/web/src/config/navigation.config.ts apps/web/src/components/guards/role-guard.tsx
git commit -m "feat(web): integrate LocationSwitcher into merchant layout, add org nav"
```

---

## Task 11: Web — Organization Management Pages

**Files:**

- Create: `apps/web/src/app/[locale]/(merchant)/merchant/organization/page.tsx`
- Create:
  `apps/web/src/components/dashboard/organization/org-locations-page.tsx`
- Create:
  `apps/web/src/components/dashboard/organization/invite-member-dialog.tsx`
- Create: `apps/web/src/components/dashboard/organization/org-members-page.tsx`
- Create:
  `apps/web/src/app/[locale]/(merchant)/merchant/organization/members/page.tsx`

- [ ] **Step 1: Create org locations page component**

Create `apps/web/src/components/dashboard/organization/org-locations-page.tsx`:

This is the main organization management view. It shows:

- Organization name + status
- List of locations with status badges (active/pending)
- "Add Location" button (links to establishment creation flow with org context)
- Per-location: name, city, status, assigned manager (if any), actions (edit,
  remove)

```tsx
'use client';

import { Building2, MapPin, Plus, Users, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyOrganization } from '@/hooks/use-organization';
import { useMyEstablishment } from '@/hooks/use-merchant-dashboard';
import type { MyEstablishment } from '@/types/dashboard';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  suspended: 'bg-red-100 text-red-700 border-red-200',
};

export function OrgLocationsPage() {
  const { data: org, isLoading: orgLoading } = useMyOrganization();
  const { data: establishment, isLoading: estLoading } = useMyEstablishment();

  if (orgLoading || estLoading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-64' />
        <Skeleton className='h-40 w-full' />
        <Skeleton className='h-40 w-full' />
      </div>
    );
  }

  if (!org) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center justify-center py-10 gap-3 text-center'>
          <Building2 className='size-12 text-muted-foreground' />
          <h3 className='text-md font-semibold'>No Organization Yet</h3>
          <p className='text-sm text-muted-foreground max-w-xs'>
            Upgrade to an enterprise account to manage multiple locations from
            one dashboard.
          </p>
          <Button>Create Organization</Button>
        </CardContent>
      </Card>
    );
  }

  const establishments: MyEstablishment[] = Array.isArray(establishment)
    ? establishment
    : establishment
      ? [establishment]
      : [];

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>{org.name}</h1>
          <p className='text-sm text-muted-foreground'>
            {establishments.length} location
            {establishments.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className='flex items-center gap-3'>
          <Badge
            className={statusColors[org.status] ?? statusColors['pending']}
          >
            {org.status}
          </Badge>
          <Button size='sm'>
            <Plus className='size-4 me-2' />
            Add Location
          </Button>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {establishments.map(est => (
          <Card key={est._id} className='relative'>
            <CardHeader className='pb-3'>
              <div className='flex items-start justify-between'>
                <CardTitle className='text-base font-semibold'>
                  {est.name}
                </CardTitle>
                <Badge
                  variant='outline'
                  className={
                    statusColors[est.status] ?? statusColors['pending']
                  }
                >
                  {est.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className='space-y-2 text-sm'>
              <div className='flex items-center gap-2 text-muted-foreground'>
                <MapPin className='size-4 shrink-0' />
                <span>{est.address?.city ?? 'Address pending'}</span>
              </div>
              <div className='flex items-center gap-2 text-muted-foreground'>
                <Users className='size-4 shrink-0' />
                <span>No manager assigned</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create invite member dialog**

Create
`apps/web/src/components/dashboard/organization/invite-member-dialog.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Mail, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@foodwaste/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInviteMember } from '@/hooks/use-organization';
import type { MyEstablishment } from '@/types/dashboard';

interface InviteMemberDialogProps {
  orgId: string;
  establishments: MyEstablishment[];
  trigger: React.ReactNode;
}

export function InviteMemberDialog({
  orgId,
  establishments,
  trigger,
}: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [establishmentId, setEstablishmentId] = useState('');
  const invite = useInviteMember(orgId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !establishmentId) return;

    await invite.mutateAsync({
      email,
      assignedEstablishmentId: establishmentId,
    });
    setEmail('');
    setEstablishmentId('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Invite Location Manager</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Email</label>
            <div className='relative'>
              <Mail className='absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground' />
              <input
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder='receptionist@hotel.tn'
                className='w-full ps-10 pe-3 py-2 border rounded-md text-sm'
                required
              />
            </div>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>Assign to Location</label>
            <Select value={establishmentId} onValueChange={setEstablishmentId}>
              <SelectTrigger>
                <SelectValue placeholder='Select a location' />
              </SelectTrigger>
              <SelectContent>
                {establishments.map(est => (
                  <SelectItem key={est._id} value={est._id}>
                    <div className='flex items-center gap-2'>
                      <MapPin className='size-3' />
                      {est.name} — {est.address?.city}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type='submit' className='w-full' disabled={invite.isPending}>
            {invite.isPending && (
              <Loader2 className='size-4 me-2 animate-spin' />
            )}
            Send Invitation
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create page routes**

Create `apps/web/src/app/[locale]/(merchant)/merchant/organization/page.tsx`:

```tsx
import { OrgLocationsPage } from '@/components/dashboard/organization/org-locations-page';

export default function OrganizationPage() {
  return <OrgLocationsPage />;
}
```

Create
`apps/web/src/app/[locale]/(merchant)/merchant/organization/members/page.tsx`:

```tsx
import { OrgMembersPage } from '@/components/dashboard/organization/org-members-page';

export default function MembersPage() {
  return <OrgMembersPage />;
}
```

- [ ] **Step 4: Create OrgMembersPage component**

Create `apps/web/src/components/dashboard/organization/org-members-page.tsx`:

```tsx
'use client';

import { UserPlus, Mail, MapPin, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useMyOrganization,
  useOrganizationInvitations,
  useRevokeInvitation,
} from '@/hooks/use-organization';
import { useMyEstablishment } from '@/hooks/use-merchant-dashboard';
import { InviteMemberDialog } from './invite-member-dialog';
import type { MyEstablishment } from '@/types/dashboard';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  expired: 'bg-gray-100 text-gray-500',
  revoked: 'bg-red-100 text-red-600',
};

export function OrgMembersPage() {
  const { data: org, isLoading: orgLoading } = useMyOrganization();
  const { data: establishment } = useMyEstablishment();
  const { data: invitations, isLoading: invLoading } =
    useOrganizationInvitations(org?._id ?? '');
  const revoke = useRevokeInvitation(org?._id ?? '');

  if (orgLoading || invLoading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-24 w-full' />
        <Skeleton className='h-24 w-full' />
      </div>
    );
  }

  if (!org) return null;

  const establishments: MyEstablishment[] = Array.isArray(establishment)
    ? establishment
    : establishment
      ? [establishment]
      : [];

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Team Members</h1>
          <p className='text-sm text-muted-foreground'>
            Manage location managers for {org.name}
          </p>
        </div>
        <InviteMemberDialog
          orgId={org._id}
          establishments={establishments}
          trigger={
            <Button size='sm'>
              <UserPlus className='size-4 me-2' />
              Invite Manager
            </Button>
          }
        />
      </div>

      {!invitations || invitations.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-10 gap-3 text-center'>
            <UserPlus className='size-12 text-muted-foreground' />
            <h3 className='text-md font-semibold'>No invitations yet</h3>
            <p className='text-sm text-muted-foreground max-w-xs'>
              Invite location managers so they can manage their assigned
              location with their own account.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-3'>
          {invitations.map(inv => (
            <Card key={inv._id}>
              <CardContent className='flex items-center justify-between py-4'>
                <div className='flex items-center gap-4'>
                  <div className='size-10 rounded-full bg-muted flex items-center justify-center'>
                    <Mail className='size-5 text-muted-foreground' />
                  </div>
                  <div>
                    <p className='text-sm font-medium'>{inv.email}</p>
                    <p className='text-xs text-muted-foreground'>
                      Location Manager
                    </p>
                  </div>
                </div>

                <div className='flex items-center gap-3'>
                  <Badge className={statusColors[inv.status] ?? ''}>
                    {inv.status}
                  </Badge>
                  {inv.status === 'pending' && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => revoke.mutate(inv._id)}
                      disabled={revoke.isPending}
                    >
                      <XCircle className='size-4 text-destructive' />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify web compiles**

Run: `pnpm --filter @foodwaste/web type-check`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/dashboard/organization/ apps/web/src/app/[locale]/(merchant)/merchant/organization/
git commit -m "feat(web): add organization management pages — locations, members, invitations"
```

---

## Task 12: Web — Accept Invitation Page

**Files:**

- Create: `apps/web/src/app/[locale]/(auth)/accept-invitation/page.tsx`

- [ ] **Step 1: Create accept invitation page**

Create `apps/web/src/app/[locale]/(auth)/accept-invitation/page.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';
import {
  Building2,
  MapPin,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  organizationService,
  type InvitationVerifyResponse,
} from '@/services/organization.service';

type PageState = 'loading' | 'form' | 'success' | 'error';

export default function AcceptInvitationPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();
  const locale = useLocale();

  const [state, setState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationVerifyResponse | null>(
    null,
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided');
      setState('error');
      return;
    }

    organizationService
      .verifyInvitation(token)
      .then(res => {
        setInvitation(res.data.data);
        setState('form');
      })
      .catch(err => {
        setError(
          err.response?.data?.message ?? 'Invalid or expired invitation',
        );
        setState('error');
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    try {
      await organizationService.acceptInvitation({
        token,
        firstName,
        lastName,
        password,
        ...(phoneNumber ? { phoneNumber } : {}),
      });
      setState('success');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? 'Failed to accept invitation';
      setError(message);
      setState('error');
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <Loader2 className='size-8 animate-spin text-primary' />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className='min-h-screen flex items-center justify-center p-4'>
        <Card className='max-w-md w-full'>
          <CardContent className='flex flex-col items-center py-10 gap-3 text-center'>
            <AlertCircle className='size-12 text-destructive' />
            <h3 className='text-lg font-semibold'>Invitation Error</h3>
            <p className='text-sm text-muted-foreground'>{error}</p>
            <Button variant='outline' onClick={() => router.push('/login')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className='min-h-screen flex items-center justify-center p-4'>
        <Card className='max-w-md w-full'>
          <CardContent className='flex flex-col items-center py-10 gap-3 text-center'>
            <CheckCircle2 className='size-12 text-green-600' />
            <h3 className='text-lg font-semibold'>Welcome aboard!</h3>
            <p className='text-sm text-muted-foreground'>
              Your account has been created. You can now log in to manage your
              location.
            </p>
            <Button onClick={() => router.push('/login')}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center p-4'>
      <Card className='max-w-md w-full'>
        <CardHeader className='text-center'>
          <div className='mx-auto mb-3 size-12 rounded-full bg-primary/10 flex items-center justify-center'>
            <Building2 className='size-6 text-primary' />
          </div>
          <CardTitle className='text-xl'>
            Join {invitation?.organizationName}
          </CardTitle>
          <p className='text-sm text-muted-foreground mt-1'>
            You've been invited to manage{' '}
            <strong>{invitation?.establishmentName}</strong>
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1'>
                <label className='text-sm font-medium'>First Name</label>
                <input
                  type='text'
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className='w-full px-3 py-2 border rounded-md text-sm'
                  required
                  minLength={2}
                />
              </div>
              <div className='space-y-1'>
                <label className='text-sm font-medium'>Last Name</label>
                <input
                  type='text'
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className='w-full px-3 py-2 border rounded-md text-sm'
                  required
                  minLength={2}
                />
              </div>
            </div>

            <div className='space-y-1'>
              <label className='text-sm font-medium'>Password</label>
              <input
                type='password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                className='w-full px-3 py-2 border rounded-md text-sm'
                required
                minLength={8}
                placeholder='Min 8 chars, uppercase, lowercase, number, special'
              />
            </div>

            <div className='space-y-1'>
              <label className='text-sm font-medium'>Phone (optional)</label>
              <input
                type='tel'
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                className='w-full px-3 py-2 border rounded-md text-sm'
                placeholder='+216 XX XXX XXX'
              />
            </div>

            <Button type='submit' className='w-full' disabled={submitting}>
              {submitting && <Loader2 className='size-4 me-2 animate-spin' />}
              Create Account & Accept
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify web compiles**

Run: `pnpm --filter @foodwaste/web type-check`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[locale]/(auth)/accept-invitation/
git commit -m "feat(web): add accept-invitation page for location managers"
```

---

## Task 13: Web — Patch Dashboard Hooks for Establishment Scoping

**Files:**

- Modify: `apps/web/src/hooks/use-merchant-dashboard.ts`
- Modify: `apps/web/src/services/dashboard.service.ts`

- [ ] **Step 1: Add establishmentId to dashboard query keys**

In `apps/web/src/hooks/use-merchant-dashboard.ts`, update query keys to include
establishment context:

```typescript
export const dashboardKeys = {
  all: ['merchant-dashboard'] as const,
  orderStats: (startDate?: string, establishmentId?: string) =>
    [
      ...dashboardKeys.all,
      'order-stats',
      startDate ?? 'all-time',
      establishmentId ?? 'all',
    ] as const,
  recentOrders: (page: number, limit: number, establishmentId?: string) =>
    [
      ...dashboardKeys.all,
      'recent-orders',
      page,
      limit,
      establishmentId ?? 'all',
    ] as const,
  merchantOrders: (page: number, limit: number, establishmentId?: string) =>
    [
      ...dashboardKeys.all,
      'merchant-orders',
      page,
      limit,
      establishmentId ?? 'all',
    ] as const,
  // ... keep existing keys, add establishmentId to relevant ones
  offers: (
    page: number,
    limit: number,
    status?: string,
    establishmentId?: string,
  ) =>
    [
      ...dashboardKeys.all,
      'offers',
      page,
      limit,
      status,
      establishmentId ?? 'all',
    ] as const,
  // myEstablishment stays the same — it returns ALL establishments for the user
  myEstablishment: () => [...dashboardKeys.all, 'my-establishment'] as const,
};
```

- [ ] **Step 2: Update dashboard service to pass establishmentId**

In `apps/web/src/services/dashboard.service.ts`, update API call methods to
accept and forward `establishmentId`:

```typescript
  getMerchantOffers(page: number, limit: number, status?: string, establishmentId?: string) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(status ? { status } : {}),
      ...(establishmentId && establishmentId !== 'all' ? { establishmentId } : {}),
    });
    return apiClient.get<BackendEnvelope<MerchantOffer[]>>(`/offers/my-offers?${params}`);
  },
```

Apply the same pattern to merchant orders and order stats endpoints.

- [ ] **Step 3: Update hooks to use activeEstablishmentId from auth store**

In the hooks, read the active establishment from the store:

```typescript
export function useMerchantOffers(
  page: number,
  limit: number,
  status?: string,
) {
  const activeEstablishmentId = useAuthStore(
    state => state.activeEstablishmentId,
  );

  return useQuery({
    queryKey: dashboardKeys.offers(
      page,
      limit,
      status,
      activeEstablishmentId ?? undefined,
    ),
    queryFn: async () => {
      const response = await dashboardService.getMerchantOffers(
        page,
        limit,
        status,
        activeEstablishmentId ?? undefined,
      );
      return {
        offers: response.data.data,
        total: response.data.meta?.total ?? 0,
      };
    },
  });
}
```

- [ ] **Step 4: Verify web compiles**

Run: `pnpm --filter @foodwaste/web type-check`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-merchant-dashboard.ts apps/web/src/services/dashboard.service.ts
git commit -m "feat(web): scope dashboard queries by active establishment for multi-location"
```

---

## Task 14: Backend — Admin Organization Management

**Files:**

- Modify: `apps/food-waste-backend/src/admin/admin.controller.ts` (or wherever
  admin endpoints live)

- [ ] **Step 1: Add admin endpoints for organization management**

The admin needs to:

1. List all organizations (with pagination)
2. Approve/reject an organization (update status)
3. View organization details with members

Add to the existing admin controller or create endpoints in the organizations
controller with `@Roles(UserRole.ADMIN)`:

The `PATCH :id/status` endpoint already exists in the organizations controller
from Task 5. Verify it works for admin approval flow.

Add a list-all endpoint for admins:

```typescript
  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: list all organizations' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    // Add findAll method to OrganizationsService
    const result = await this.organizationsService.findAll(page, limit, status);
    return {
      message: 'Organizations retrieved',
      data: result.organizations,
      meta: { page, limit, total: result.total },
    };
  }
```

Add `findAll()` to `OrganizationsService`:

```typescript
  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: string,
  ): Promise<{ organizations: OrganizationDocument[]; total: number }> {
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const query: FilterQuery<OrganizationDocument> = { isDeleted: { $ne: true } };
    if (status) {
      query.status = status;
    }

    const [organizations, total] = await Promise.all([
      this.organizationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .populate('ownerId', 'firstName lastName email')
        .lean(),
      this.organizationModel.countDocuments(query),
    ]);

    return { organizations: organizations as OrganizationDocument[], total };
  }
```

- [ ] **Step 2: Verify backend compiles**

Run: `pnpm --filter @foodwaste/backend type-check`

- [ ] **Step 3: Commit**

```bash
git add apps/food-waste-backend/src/organizations/ apps/food-waste-backend/src/admin/
git commit -m "feat(backend): add admin organization listing and approval endpoints"
```

---

## Task 15: i18n — Add Translation Keys

**Files:**

- Modify: `apps/web/src/messages/en.json`
- Modify: `apps/web/src/messages/fr.json`
- Modify: `apps/web/src/messages/ar.json`

- [ ] **Step 1: Add English translation keys**

Add under the `dashboard.nav` section:

```json
{
  "dashboard": {
    "nav": {
      "organization": "Organization"
    },
    "organization": {
      "title": "Organization",
      "noOrg": "No Organization Yet",
      "noOrgDescription": "Upgrade to an enterprise account to manage multiple locations.",
      "createOrg": "Create Organization",
      "locations": "Locations",
      "members": "Team Members",
      "addLocation": "Add Location",
      "inviteManager": "Invite Manager",
      "allLocations": "All Locations",
      "noManagerAssigned": "No manager assigned",
      "invitationSent": "Invitation sent",
      "invitationRevoked": "Invitation revoked",
      "noInvitations": "No invitations yet",
      "noInvitationsDescription": "Invite location managers so they can manage their assigned location.",
      "locationManager": "Location Manager"
    }
  }
}
```

- [ ] **Step 2: Add French translations**

Same structure with French values.

- [ ] **Step 3: Add Arabic translations**

Same structure with Arabic values. Verify RTL rendering.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/messages/
git commit -m "feat(i18n): add organization management translation keys (en, fr, ar)"
```

---

## Task 16: Full Integration Verification

- [ ] **Step 1: Build shared package**

Run: `pnpm build:deps`

Expected: Clean build.

- [ ] **Step 2: Backend type check**

Run: `pnpm --filter @foodwaste/backend type-check`

Expected: No errors.

- [ ] **Step 3: Web type check**

Run: `pnpm --filter @foodwaste/web type-check`

Expected: No errors.

- [ ] **Step 4: Run backend tests**

Run: `pnpm --filter @foodwaste/backend test`

Expected: All existing tests pass. New code is not tested yet (test coverage
comes in a follow-up).

- [ ] **Step 5: Run web tests**

Run: `pnpm --filter @foodwaste/web test`

Expected: All existing tests pass.

- [ ] **Step 6: Start dev servers and verify manually**

Run: `pnpm dev`

Verify:

1. Solo merchant login → dashboard works as before, no location switcher visible
2. Organization creation flow (manual API call or UI)
3. Location switcher appears for org owners with 2+ locations
4. Invitation email sends with correct link
5. Accept invitation page renders at `/en/accept-invitation?token=xxx`
6. Location manager can log in and sees only their assigned establishment
7. Admin can list and approve organizations

- [ ] **Step 7: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes for multi-location enterprise system"
```

---

## Data Flow Summary

```
Enterprise Owner (MERCHANT role)
  │
  ├─ Creates Organization (name, first establishment)
  │     → Admin approves (status: PENDING → ACTIVE)
  │
  ├─ Adds more Establishments to Organization
  │     → Each gets organizationId set
  │
  ├─ Invites Location Manager (email + assignedEstablishmentId)
  │     → Invitation stored in DB, email sent with token
  │     → Manager clicks link → AcceptInvitationPage
  │     → Creates User (role: LOCATION_MANAGER, organizationId, assignedEstablishmentId)
  │     → JWT includes org context
  │
  └─ Dashboard: LocationSwitcher filters all queries by activeEstablishmentId

Location Manager (LOCATION_MANAGER role)
  │
  ├─ Logs in with own credentials
  ├─ JWT contains assignedEstablishmentId
  ├─ All queries auto-scoped to their establishment
  ├─ Cannot: create org, add locations, invite people, see other locations
  └─ Can: manage offers, view orders, update establishment details, upload documents
```

## What Stays Unchanged

- Solo merchants (no organization) — zero impact on their flow
- Consumer-facing search/browse — they see individual establishments, not chains
- Mobile app — completely untouched
- Payment system — per-order, per-establishment
- Review system — per-establishment

## Edge Cases — Must Handle

### 1. Orphaned Managers (Establishment Removal Cascade)

When an establishment is removed from an organization (soft-deleted), any
`LOCATION_MANAGER` user with `assignedEstablishmentId` pointing to that
establishment must be **suspended** (not deleted). The `removeEstablishment`
service method handles this cascade. The owner can later reassign them to a
different location.

### 2. Fired Manager — Immediate Revocation

The JWT `validate()` function hits the DB on every request
(`usersService.findByEmail` → checks `status !== ACTIVE`). This means setting a
manager's status to `SUSPENDED` immediately blocks all their API calls — even
with a valid JWT. No Redis cache needed for MVP; the DB lookup is the security
feature. Future optimization: cache user status in Redis with short TTL (60s).

### 3. Legacy Data Compatibility

- `organizationId` is optional on both Establishment and User schemas. Existing
  merchants without it work exactly as before.
- Frontend uses optional chaining (`user?.organizationId`,
  `establishment?.organizationId`) — no crashes on legacy data.
- The `LOCATION_MANAGER` enum value is new. No existing user has this role, so
  no migration needed. Frontend `RoleGuard` already does
  `allowedRoles.includes(user.role)` — unknown roles simply don't match, no
  crash.

### 4. User Soft Delete Pattern

- **Establishment** uses `isDeleted: boolean` + pre-find middleware
  auto-exclude.
- **User** uses `deletedAt: Date` + `status: UserStatus.DELETED` + partial
  unique index on email (`partialFilterExpression: { deletedAt: null }`).
- For manager suspension, we use `status: SUSPENDED` (not delete). They can be
  reactivated.
