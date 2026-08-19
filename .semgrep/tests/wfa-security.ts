/* eslint-disable */
// @ts-nocheck
//
// Semgrep rule fixtures for .semgrep/wfa-security.yml
//
// Verify the rules actually match what they claim:
//   docker run --rm -v "${PWD}:/src" -w /src semgrep/semgrep:latest \
//     semgrep --test --config .semgrep/wfa-security.yml .semgrep/tests/
//
// `ruleid:` marks a line that MUST be flagged. `ok:` marks a line that must
// NOT be flagged. A rule that fires on the `ok:` cases is worse than no rule —
// it trains people to ignore the gate.

import { ValidationPipe } from '@nestjs/common';

// ---------------------------------------------------------------- F1 ------

// ruleid: wfa-validation-pipe-must-use-shared-factory
const inlinePipe = new ValidationPipe({ transform: true });

// ruleid: wfa-validation-pipe-missing-whitelist
const noWhitelist = new ValidationPipe({ transform: true });

// ruleid: wfa-validation-pipe-missing-whitelist
const explicitlyLenient = new ValidationPipe({ transform: true, forbidNonWhitelisted: false });

// ok: wfa-validation-pipe-missing-whitelist
const whitelisted = new ValidationPipe({ transform: true, whitelist: true });

// ok: wfa-validation-pipe-missing-whitelist
const strict = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

// ---------------------------------------------------------------- F2 ------

class TokenService {
  // ruleid: wfa-math-random-for-security-value
  generatePasswordSuggestion(): string {
    return `pw${Math.floor(Math.random() * 999)}`;
  }

  // ruleid: wfa-math-random-for-security-value
  createResetToken(): string {
    return Math.random().toString(36);
  }

  // ok: wfa-math-random-for-security-value
  jitterRetryDelay(): number {
    return Math.random() * 60000;
  }
}

// ---------------------------------------------------------------- F4 ------

class OrderService {
  // ruleid: wfa-authz-guard-skipped-when-identity-absent
  async findByIdOptional(order: any, userId?: string, userRole?: string) {
    if (userId && userRole !== 'ADMIN') {
      const isCustomer = order.customerId.toString() === userId;
      if (!isCustomer) {
        throw new ForbiddenException('Access denied');
      }
    }
    return order;
  }

  // ok: wfa-authz-guard-skipped-when-identity-absent
  async findByIdRequired(order: any, userId: string, userRole: string) {
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
