---
paths:
  - 'apps/food-waste-backend/**/*.ts'
---

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
