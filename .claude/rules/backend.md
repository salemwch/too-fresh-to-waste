---
paths:
  - 'apps/food-waste-backend/**/*.ts'
---

# Backend Coding Rules

Rules specific to `apps/food-waste-backend`. Architecture is documented in project CLAUDE.md — these are coding-level decisions only.

1. **Relative imports only** — no path aliases. Backend does not use `@/` or `@foodwaste/*` in its own code.
2. **`@Prop()` with union types**: always add explicit `type:` option when property uses `| undefined` (e.g., `@Prop({ type: Date })`). Mongoose `reflect-metadata` emits `Object` for unions → runtime crash.
3. **Do NOT enable** `@nestjs/swagger` CLI plugin in `nest-cli.json` — it resolves `@foodwaste/shared` to broken relative paths at compile time. Use manual `@ApiProperty()` decorators.
4. **DTOs**: always create separate request + response DTOs. Use `class-validator` for input, `class-transformer` for output.
5. **Guard chain**: AuthGuard → RolesGuard → ThrottlerGuard. Order matters.
6. **Integration tests** hit real MongoDB — no mocks for database tests.
7. **Structured logging**: always include `correlationId` from request context.
8. **OpenAPI spec**: `pnpm generate` in `packages/shared` fetches spec from running backend and generates types. Spec committed to git for diff visibility.
