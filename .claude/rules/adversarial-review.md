# Adversarial Review

Self-review is the weakest form of review. Re-reading your own diff confirms
what you already believe: you reconstruct the intent you had while writing, and
the code reads as correct because it matches the intent rather than because it
matches reality.

Review is a **separate pass with a different brief**. It runs after the change
is complete, it is told what to hunt, and it is not allowed to grade the work as
good or bad — only to report what is missing.

> Adapted from the review prompts in
> [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (MIT), fitted to
> this codebase.

---

## The four lenses

Run them in this order. Each has one job and must not drift into the others.

| Lens                 | Question it answers                                       | When            |
| -------------------- | --------------------------------------------------------- | --------------- |
| **Edge case hunter** | Which reachable paths have no explicit guard?             | Always          |
| **Deletion check**   | Did removed code carry a contract nothing re-established? | If code removed |
| **Claims check**     | Does the code actually do what the plan says it does?     | Always          |
| **Verification gap** | If this broke where it's used, would anything fail?       | Always          |

---

## Lens 1 — Edge case hunter

**You are a pure path tracer. Never comment on whether code is good or bad; only
list missing handling.**

Scope: the diff hunks, plus anything directly reachable from the changed lines.
Not the rest of the repo unless the diff explicitly references it.

Method is **exhaustive enumeration, not intuition**. Walk every branch
mechanically:

- Control flow — conditionals, loops, early returns, error handlers, `finally`
- Domain boundaries — where a value, state, or condition transitions
- Derive the edge classes from the code in front of you; don't run a fixed
  checklist

**Implicit branches are where this codebase actually breaks.** When a diff
special-cases _some_ members of a fixed set, every untouched member is an
implicit branch. This repo is full of fixed sets:

| Fixed set            | Members                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| Order status         | `PENDING → RESERVED → CONFIRMED → READY_FOR_PICKUP → PICKED_UP` (pickup)          |
|                      | `PENDING → CONFIRMED → DRIVER_ASSIGNED → OUT_FOR_DELIVERY → DELIVERED` (delivery) |
| `deliveryMode`       | `pickup` \| `delivery`                                                            |
| `authProvider`       | `local` \| `google` \| `facebook` \| `apple`                                      |
| `UserStatus`         | `ACTIVE` \| `PENDING` \| `SUSPENDED` \| `BLOCKED` \| `DELETED` \| `ANONYMIZED`    |
| Role                 | `consumer` \| `merchant` \| `admin` \| `moderator`                                |
| `DonationPoolStatus` | `ACTIVE` \| `FUNDED` \| `SEASON_COMPLETE` \| `ARCHIVED` \| `PAUSED`               |
| Locale               | `en` \| `fr` \| `ar` (RTL)                                                        |

A change that handles `CONFIRMED` and `READY_FOR_PICKUP` has left the entire
delivery chain as implicit branches. Name them.

**Report only unhandled paths. Discard handled ones silently.** No severity
labels, no rankings, no priority — the trace pass does not editorialize. Ranking
happens later, by a human.

---

## Lens 2 — Deletion check

Runs only when the diff removed or replaced meaningful code. Ignore pure renames
and whitespace.

For each removed chunk: **did it carry behavior or a contract that the change
neither re-established nor intentionally retired?** Report the resulting
regression, orphaned reference, or newly-dead code.

Findings here are inferences — say so. Usually few or none.

---

## Lens 3 — Claims check

Read the plan **after** the trace is finished, never before. If you read the
claims first they steer the trace, and you end up verifying the story instead of
the code.

> **The plan is the change's own account of itself: testimony, not evidence. A
> claim repeated in a code comment is still the same claim, not confirmation.**

Extract every checkable claim — what it does, what it preserves, ordering,
arithmetic, and especially **parity claims** ("exactly as X does", "same as the
web flow", "mirrors `getEstablishmentName`") — then try to **falsify** each one
against the code you already traced. Where the trace can't decide it, go read
the thing being compared to.

Parity claims are the highest-yield target in this repo, because the same logic
genuinely does exist in three places (mobile / web / backend) and drifts:

- `unwrapBackendResponse()` (mobile) vs `response.data.data` (web)
- Pricing split — `81/19`, delivery fee driver `80%` / platform `20%`, donation
  `subtotal * 0.19 * 0.05`
- Order expiry — `offer.availableUntil + ORDER_GRACE_PERIOD_MS`
- `profileImage > avatar > null`

Verified claims produce nothing. Add nothing if nothing is falsified.

---

## Lens 4 — Verification gap

One question: **if the behavior this change produces broke where it is actually
used, would verification fail?**

Not a correctness hunt. A coverage-reality hunt.

### Three shapes

1. **Regression gap** — the code regresses where it's used and no test that runs
   would fail.
2. **Missing-adoption gap** — a site that should now use the new behavior
   doesn't, and nothing flags it.
3. **Broken-verification gap** — a test _looks_ like it covers this but
   wouldn't: skipped, flaky, outside the normal run, or too weak to observe the
   regression.

### Evidence rules — non-negotiable

- **Read the test before claiming what it covers.** File names lie.
- **Before claiming no test exists**, search the whole repo by the symbol _and_
  by import references. "I looked where it should be" is not a search.
- **Never assert what you did not verify.** If a finding can't be grounded, drop
  it.
- **State how far you looked**: "none of the tests I read cover this" — not
  "this is untested".

### What does not count as a test

- No execution at all
- Source-text assertions that match a file's wording instead of running it
- Success-only / no-throw / snapshot-only checks
- Mock-call or log-call assertions
- Tests that mock away the very integration under test
- E2E tests that pass through without checking the changed output
- Stale assertions or fixtures

The canonical trap:

```ts
expect(x ?? DEFAULT).toBe(DEFAULT); // passes when x is missing — proves nothing
```

### Screen out non-behavioral parts first

A part is non-behavioral only when it alters no return value, no thrown error,
no caller-visible side effect, and no observable state (including iteration
order and emitted messages). Formatting, comments, pure renames, type-only
changes, trivial pass-throughs.

Treat as behavioral even when no single line looks important: dependency bumps,
toolchain, build config, data files. See `.claude/rules/dependencies.md` — the
`brace-expansion` override passed type-check and tests and broke ESLint
entirely.

### Demonstration is required

For each consumer, name the **smallest realistic regression** it would observe —
invert the branch, drop the default, omit the field, return the old error code,
skip the settlement call. Then ask whether any test you actually read would
fail.

If no such regression exists, drop the path. Untested downstream code is not a
finding.

---

## What none of these lenses may do

- Assign severity, confidence, priority, or ranking during the trace
- Report compiler- or type-checker-enforced cases
- Report low coverage or a missing test file as a finding in itself
- Report legacy untested code the change did not touch
- Editorialize, suggest style, or praise

---

## Running it

```bash
/code-review                 # working diff
/code-review ultra           # multi-agent cloud review of the branch
```

For a manual pass, dispatch each lens as its **own** agent with its own brief —
one agent running all four collapses them into a single vague opinion, which is
the thing this rule exists to prevent.
