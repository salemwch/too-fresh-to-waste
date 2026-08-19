/* eslint-disable */
// @ts-nocheck
//
// Semgrep rule fixtures for wfa-security.yml
//
// Verify the rules actually match what they claim:
//   docker run --rm -v "${PWD}:/src" -w /src semgrep/semgrep:latest \
//     semgrep --test --config .semgrep/wfa-security.yml .semgrep/wfa-security.ts
//
// `ruleid:` marks the NEXT line as one that MUST be flagged. `ok:` marks it as
// one that must NOT be. A rule that fires on an `ok:` case is worse than no
// rule — it trains people to ignore the gate.
//
// Note: `--test` bypasses the `paths:` filters in the rule file, so rules
// scoped to apps/food-waste-backend still evaluate here. That is why a line
// can carry two `ruleid:` annotations — both rules genuinely fire on it.

import { ValidationPipe } from '@nestjs/common';

// ---------------------------------------------------------------- F1 ------
// Every inline `new ValidationPipe(...)` trips the shared-factory rule. Only
// those without `whitelist: true` additionally trip the whitelist rule.

// ruleid: wfa-validation-pipe-must-use-shared-factory,wfa-validation-pipe-missing-whitelist
const inlinePipe = new ValidationPipe({ transform: true });

// ruleid: wfa-validation-pipe-must-use-shared-factory,wfa-validation-pipe-missing-whitelist
const explicitlyLenient = new ValidationPipe({ transform: true, forbidNonWhitelisted: false });

// Whitelisted, so the whitelist rule stays silent — but it is still an inline
// pipe, so the shared-factory rule must still fire.
// ruleid: wfa-validation-pipe-must-use-shared-factory
const whitelisted = new ValidationPipe({ transform: true, whitelist: true });

// whitelist is set, so only the shared-factory rule fires here
// ruleid: wfa-validation-pipe-must-use-shared-factory
const strict = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

// The sanctioned form: no inline pipe at all, so neither rule fires.
const shared = strictValidation();

// ---------------------------------------------------------------- F2 ------
// The rule anchors on the Math.random() call, gated by the enclosing
// function's name.

class TokenService {
  generatePasswordSuggestion(): string {
    // ruleid: wfa-math-random-for-security-value
    return `pw${Math.floor(Math.random() * 999)}`;
  }

  createResetToken(): string {
    // ruleid: wfa-math-random-for-security-value
    return Math.random().toString(36);
  }

  jitterRetryDelay(): number {
    // Same call, non-security context — the function name is what decides.
    // ok: wfa-math-random-for-security-value
    return Math.random() * 60000;
  }
}

// ---------------------------------------------------------------- F4 ------
// The rule anchors on the `if` whose guard is skipped when the identity
// argument is absent, not on the method signature.

class OrderService {
  async findByIdOptional(order: any, userId?: string, userRole?: string) {
    // ruleid: wfa-authz-guard-skipped-when-identity-absent
    if (userId && userRole !== 'ADMIN') {
      const isCustomer = order.customerId.toString() === userId;
      if (!isCustomer) {
        throw new ForbiddenException('Access denied');
      }
    }
    return order;
  }

  async findByIdRequired(order: any, userId: string, userRole: string) {
    // Identity is required, so the guard cannot be skipped.
    // ok: wfa-authz-guard-skipped-when-identity-absent
    if (userRole !== 'ADMIN') {
      const isCustomer = order.customerId.toString() === userId;
      if (!isCustomer) {
        throw new ForbiddenException('Access denied');
      }
    }
    return order;
  }
}

// ----------------------------------------------------------------- JWT ----

declare const jwt: any;

// ruleid: wfa-jwt-decode-without-verification
const claims = jwt.decode(rawToken);

// ok: wfa-jwt-decode-without-verification
const verified = jwt.verify(rawToken, secret, { algorithms: ['HS256'] });

// --------------------------------------------------- mass assignment ------

declare const userModel: any;
declare const req: any;

// ruleid: wfa-mongoose-update-from-raw-request
await userModel.findByIdAndUpdate(id, req.body);

// ruleid: wfa-mongoose-update-from-raw-request
Object.assign(userDoc, req.body);

// ruleid: wfa-mongoose-update-from-raw-request
const created = new userModel(req.body);

// ok: wfa-mongoose-update-from-raw-request
await userModel.findByIdAndUpdate(id, { firstName: dto.firstName, lastName: dto.lastName });
