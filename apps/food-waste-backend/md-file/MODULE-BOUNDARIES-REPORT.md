# Module Boundaries Analysis Report

**Date:** 2026-01-22
**Architecture:** Modular Monolith
**Status:** Phase 1 Complete (Non-breaking)

---

## Summary

Phase 1 implementation complete. Added dependency analysis and ESLint boundary enforcement in **warn mode** (non-blocking).

**Current State:**

- ✅ 30 dependency violations detected by dependency-cruiser
- ✅ ESLint module boundary rules active (warn mode)
- ✅ No builds broken
- ✅ No runtime impact

---

## Tools Installed

### 1. **dependency-cruiser** (v17.3.6)

Analyzes module dependencies and detects violations.

**Scripts added:**

```bash
pnpm deps:validate  # Run validation
pnpm deps:report    # Generate detailed report
pnpm deps:graph     # Generate SVG graph (requires Graphviz)
```

**Config:** `.dependency-cruiser.js`

### 2. **eslint-plugin-import** + **eslint-import-resolver-typescript**

Enforces import restrictions at development time.

**Config:** `eslint.config.js` (updated with module boundary zones)

---

## Detected Violations

### Dependency-Cruiser Report (30 warnings)

#### **1. Users Module Violations (4)**

```
src/users/user.module.ts
├── → src/orders/order.module.ts
└── → src/favorites/favorites.module.ts

src/users/services/privacy-compliance.service.ts
├── → src/orders/schemas/order.schema.ts
└── → src/favorites/schemas/favorite.schema.ts
```

**Issue:** Users module directly imports business logic modules.
**Recommendation:** Use events for data deletion during privacy compliance.

---

#### **2. Payments Module Violations (4)**

```
src/payments/payments.controller.ts
├── → src/auth/guards/roles.guard.ts
├── → src/auth/guards/jwt-auth.guard.ts
├── → src/auth/decorators/roles.decorator.ts
└── → src/auth/decorators/public.decorator.ts
```

**Issue:** Payments imports auth guards/decorators.
**Recommendation:** Move guards/decorators to `common/` or create a shared `@Public()` decorator in common.

---

#### **3. Orders Module Violations (4)**

```
src/orders/order.service.ts
├── → src/loyalty/services/gamification.service.ts
└── → src/loyalty/loyalty.service.ts

src/orders/order.module.ts
├── → src/loyalty/loyalty.module.ts
└── → src/donations/donations.module.ts
```

**Issue:** Orders directly calls loyalty/donations.
**Recommendation:** Emit `order.completed` event → Loyalty/Donations listen and react.

---

#### **4. Offers Module Violations (6)**

```
src/offers/offers.service.ts
└── → src/favorites/schemas/favorite.schema.ts

src/offers/offers.controller.ts
├── → src/users/schemas/user.schema.ts
├── → src/auth/guards/roles.guard.ts
├── → src/auth/guards/jwt-auth.guard.ts
├── → src/auth/decorators/roles.decorator.ts
└── → src/auth/decorators/public.decorator.ts
```

**Issue:** Offers imports user schema + auth decorators.
**Recommendation:**

- Move auth decorators to `common/`
- Query users via `UsersService` facade instead of direct schema import

---

#### **5. Common Module Violations (5)**

```
src/common/security/session-management.service.ts
└── → src/users/schemas/user.schema.ts

src/common/controllers/metrics.controller.ts
└── → src/auth/decorators/public.decorator.ts

src/common/controllers/csp-report.controller.ts
└── → src/auth/decorators/public.decorator.ts

src/common/common.module.ts
└── → src/users/schemas/user.schema.ts
```

**Issue:** Common depends on feature modules (violates "stable dependencies" principle).
**Recommendation:**

- Move `@Public()` decorator to `common/decorators/`
- Move session management to `auth/` or use abstract interfaces

---

#### **6. Auth Module Violations (2)**

```
src/auth/auth.service.ts
└── → src/loyalty/services/gamification.service.ts

src/auth/auth.module.ts
└── → src/loyalty/loyalty.module.ts
```

**Issue:** Auth imports loyalty for signup rewards.
**Recommendation:** Emit `user.registered` event → Loyalty listens.

---

#### **7. Circular Dependency (1)**

```
src/reviwes/reviwes.module.ts
  ↓
src/users/user.module.ts
  ↓
src/reviwes/reviwes.module.ts
```

**Issue:** Reviews ↔ Users circular dependency.
**Recommendation:** Use `forwardRef()` or introduce event-driven communication.

---

#### **8. Orphan Files (3)**

```
- src/users/services/privacy-compliance.service.spec.ts
- src/reviwes/dto/update-reviwe.dto.ts
- src/payments/schemas/payment-method.schema.ts
```

**Issue:** Files not imported anywhere.
**Recommendation:** Remove if unused, or add to appropriate modules.

---

## ESLint Boundary Rules

**Mode:** `warn` (non-blocking)
**Coverage:** 70+ boundary rules across all modules

**Example violations detected:**

```bash
$ pnpm exec eslint src/users/user.module.ts

src/users/user.module.ts
  15:30  warning  Users should not depend on orders. Use events instead
  16:33  warning  Users should not depend on favorites. Use events instead
  17:31  warning  Users should not depend on reviews
```

---

## Impact Assessment

### ✅ **Safe (No Breaking Changes)**

- Tools are analysis-only
- ESLint rules in `warn` mode (doesn't fail builds)
- No code modified
- Husky pre-commit hooks still pass

### ⚠️ **Action Required Before Switching to 'error' Mode**

1. Fix 30 dependency violations
2. Refactor to event-driven architecture
3. Move common decorators/guards

---

## Next Steps (Phase 2)

### **Option A: Incremental Fixes** (Recommended)

Fix violations module by module:

1. Move `@Public()` decorator to `common/` (fixes 6 violations)
2. Implement event bus for auth → loyalty (fixes 2 violations)
3. Refactor users privacy service to use events (fixes 4 violations)
4. Continue iteratively

### **Option B: Switch to Error Mode Now**

Switch ESLint rules to `'error'` level to enforce boundaries immediately:

```javascript
'import/no-restricted-paths': ['error', { ... }]
```

**Risk:** Will fail builds until violations are fixed.

### **Option C: Generate Dependency Graph**

Visualize the current module relationships:

```bash
pnpm deps:graph
```

**Note:** Requires Graphviz installed (`choco install graphviz` on Windows).

---

## Commands Reference

```bash
# View violations
pnpm deps:report

# Validate dependencies
pnpm deps:validate

# Lint with boundary checks
pnpm check:lint

# Auto-fix other ESLint issues (boundaries still warn)
pnpm lint

# Generate dependency graph (requires Graphviz)
pnpm deps:graph
```

---

## Files Modified

```
apps/food-waste-backend/
├── .dependency-cruiser.js        # NEW: Dependency rules
├── eslint.config.js              # MODIFIED: Added import restrictions
├── package.json                  # MODIFIED: Added deps scripts
├── pnpm-lock.yaml                # MODIFIED: New dependencies
└── MODULE-BOUNDARIES-REPORT.md   # NEW: This report
```

**Dependencies Added:**

- `dependency-cruiser@^17.3.6`
- `eslint-plugin-import@^2.32.0`
- `eslint-import-resolver-typescript@^4.4.4`

---

## Recommendations

**Priority 1 (High Impact, Low Effort):**

1. Move auth decorators to `common/decorators/` (fixes 6+ violations)
2. Remove orphan files (cleanup)
3. Fix circular dependency in reviews/users

**Priority 2 (Medium Impact, Medium Effort):**

1. Implement event bus using `@nestjs/event-emitter` (already installed)
2. Refactor auth → loyalty signup flow to use events
3. Refactor orders → loyalty/donations to use events

**Priority 3 (Strategic, High Effort):**

1. Create facade services for cross-module queries
2. Separate database schemas (no direct schema imports)
3. Switch ESLint to error mode after violations fixed

---

**Status:** ✅ Phase 1 Complete - Safe to commit and continue development.
