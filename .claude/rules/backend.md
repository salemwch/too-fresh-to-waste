---
paths:
  - 'apps/food-waste-backend/**/*.ts'
---
DOMAIN-FIRST DEVELOPMENT RULE

Before creating any code, database schema, API, or infrastructure:

Focus first on:

1. Domain Understanding
- What business problem are we solving?
- What are the core concepts?
- What entities exist?
- What are their relationships?
- What terminology does the business use?

2. Actors & Permissions
- Who interacts with the system?
- What roles exist?
- What can each role do?
- What is forbidden for each role?

3. Business Rules
- What rules define the business?
- What conditions must always be true?
- What actions are allowed?
- What actions are forbidden?
- What validations must happen?

Example questions:
- Can this entity change state?
- Who can perform this action?
- When is this action impossible?
- What happens if something fails?

4. Use Cases
For every important action define:
- Who performs it?
- What triggers it?
- What inputs are required?
- What validations happen?
- What is the expected result?
- What errors can occur?

5. Workflows
Define complete lifecycle flows:

Example:
Created
↓
Approved
↓
Processing
↓
Completed

Include:
- Normal flow
- Failure flow
- Cancellation flow
- Recovery flow

6. State Management
For every important entity define:
- Possible states
- Allowed transitions
- Forbidden transitions

Example:

Order:
PENDING → CONFIRMED → COMPLETED

Forbidden:
COMPLETED → PENDING

7. Edge Cases
Think about abnormal situations:

- Duplicate actions
- Network failure
- Payment failure
- User cancellation
- Missing data
- Race conditions
- Fraud attempts

8. Constraints
Define technical and business limits:

- Quantity limits
- Time limits
- Permission limits
- Geographic limits
- Financial limits

9. Domain Events
Identify important events:

Example:

OrderCreated
PaymentCompleted
PickupConfirmed
FoodExpired

Define:
- What triggers the event?
- Who needs to react?
- What data is included?

10. Data Requirements
Before database design:

- What information must be stored?
- What history must be preserved?
- What data must never be deleted?
- What needs auditing?       
# Backend Coding Rules

Rules specific to `apps/food-waste-backend`. Architecture is documented in
project CLAUDE.md — these are coding-level decisions only.

1. **Relative imports only** — no path aliases. Backend does not use `@/` or
   `@foodwaste/*` in its own code.
2. **`@Prop()` with union types**: always add explicit `type:` option when
   property uses `| undefined` (e.g., `@Prop({ type: Date })`). Mongoose
   `reflect-metadata` emits `Object` for unions → runtime crash.
3. **Do NOT enable** `@nestjs/swagger` CLI plugin in `nest-cli.json` — it
   resolves `@foodwaste/shared` to broken relative paths at compile time. Use
   manual `@ApiProperty()` decorators.
4. **DTOs**: always create separate request + response DTOs. Use
   `class-validator` for input, `class-transformer` for output.
5. **Guard chain**: AuthGuard → RolesGuard → ThrottlerGuard. Order matters.
6. **Integration tests** hit real MongoDB — no mocks for database tests.
7. **Structured logging**: always include `correlationId` from request context.
8. **OpenAPI spec**: `pnpm generate` in `packages/shared` fetches spec from
   running backend and generates types. Spec committed to git for diff
   visibility.
9. **JWT payload fields**: The JWT strategy returns
   `{ userId, email, role, organizationId?, assignedEstablishmentId? }`. Use
   `req.user.userId` — never `req.user.sub` (that's the raw JWT claim, already
   mapped by the strategy).
10. **MongoDB ObjectId in queries**: `ownerId`, `organizationId`, and other
    `Ref` fields are stored as `ObjectId`. When querying with a string (e.g.,
    from JWT), always wrap in `new Types.ObjectId(stringId)`. Raw string
    comparison silently returns no results.
11. **External API tokens/IDs**: When constructing tokens or IDs sent to
    external APIs (Konnect, payment gateways), avoid underscores — use hyphens
    or alphanumeric only. Always check the provider's character constraints.
12. **Error messages for end-users**: Backend error messages in
    `throw new ForbiddenException(...)` / `BadRequestException(...)` etc. reach
    the frontend. Write them as user-facing copy, never as developer-facing
    instructions (no "contact admin", no technical jargon).
13. **Subscription status checks**: When gating features behind subscription
    status, check **every code path** that allows the action — not just the
    obvious one. For offers: both `create()` and `updateStatus()` (publishing)
    must check `subscriptionStatus`.
