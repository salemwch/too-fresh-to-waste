# Registration Chains

Almost nothing in this repo is one edit. A thing is **declared** in one file and
**resolved** in another, and the two halves are not checked against each other
by the compiler.

Add only the first half and everything looks fine: `tsc` passes, the build
succeeds, the test suite is green. The defect surfaces later, in a browser, in a
locale you do not read, on a page you were not working on.

> `MISSING_MESSAGE: dashboard.nav.commission (en)`
>
> Shipped with the admin commission page. The nav entry was added; the label in
> the three locale files was not. Nothing failed until someone opened an
> unrelated admin tab a week later.

---

## The rule

**When you add anything, ask: what resolves this?** Then add that too, in the
same commit.

And when you find a chain that nothing checks: **write the check, do not write a
reminder.** A rule in this file is something I can forget. A test is not.

---

## Known chains

Each row is a thing you might add, everything that must move with it, and the
command that proves it.

| You add                  | Must also change                                                 | Proof                                                     |
| ------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------- |
| Sidebar nav item         | `titleKey` label in `en` / `fr` / `ar`, and the route must exist | `registration-chains.test.ts`                             |
| A page in a route group  | The group layout's `*_NAMESPACES` array                          | `registration-chains.test.ts`, `.claude/rules/web.md` §11 |
| An i18n key              | All three locale files, same commit                              | `registration-chains.test.ts`                             |
| A public marketing route | Sitemap entry + an internal link                                 | `__tests__/seo/sitemap-routes.test.ts`                    |
| A NestJS service         | Module `providers`, `exports`, and `services/index.ts`           | `check:ts`                                                |
| A NestJS controller      | Module `controllers` and `controllers/index.ts`                  | `check:ts`                                                |
| A constructor dependency | **Every** `TestingModule` that builds that class                 | `pnpm --filter @foodwaste/backend test`                   |
| A Mongoose schema field  | Every aggregation that reads the old shape                       | `test:db`                                                 |
| A schema index           | `verify:indexes:strict`, then `db:create-indexes`                | `verify:indexes:strict`                                   |
| A backend response type  | The mirrored type in `apps/web/src/types/`                       | nothing - see below                                       |
| A UI file with spacing   | Regenerate the spacing baseline                                  | `check:design`                                            |
| A `package.json` edit    | `pnpm fix:lockfile`, same commit                                 | `check:lockfile`                                          |

### The two with no automated proof

**Backend type ↔ frontend type.** They are hand-mirrored across the HTTP
boundary, so nothing compares them. `CommissionLedgerRow.createdAt` stayed
`string` in `apps/web` after the backend began returning `string | null`, and
the compiler was satisfied on both sides. Prefer generated types
(`packages/shared`, `pnpm generate`) for anything new.

**Response envelope shape.** `/offers/expiring` is double-nested -
`OffersService` returns `{ data, total }` and the controller wraps it again - so
`r.data.data` is the wrapper, not the array. A call site cast it with
`as ExpiringOfferItem[]` and shipped `.map is not a function`.

---

## `as` is how a chain breaks silently

Both of those reached production because a cast told the compiler to stop
looking. `as` does not convert anything; it only removes the one check that
would have caught the mismatch.

```ts
const items = (data ?? []) as ExpiringOfferItem[]; // data was the envelope
```

Unwrap in the hook so every consumer gets the real shape, and let the call site
be plainly typed. If a cast genuinely is needed, the comment must say what makes
it safe.

---

## Before saying a feature is done

Not a checklist to admire - run them.

1. **Grep for the thing you added.** `grep -rn "<newKey>" apps/` should find the
   declaration _and_ every resolver. One hit means half a chain.
2. **Run the gate for the scope** (CLAUDE.md § Verification Gates).
3. **Open the feature in `fr` and `ar`**, not only `en`. A missing key renders
   as a raw path, and English is usually the locale that has it.
4. **Break it and confirm the suite fails.** If nothing goes red, the chain has
   no check - add one, per the rule above.
