import { ValidationPipe } from '@nestjs/common';

/**
 * Shared parameter-level ValidationPipe factories.
 *
 * @rationale A pipe passed to `@Body()` / `@Query()` / `@Param()` **replaces**
 * the global pipe configured in `main.ts` for that parameter — it does not
 * merge with it. So `@Body(new ValidationPipe({ transform: true }))` silently
 * drops the global `whitelist` / `forbidNonWhitelisted` settings and reopens
 * the mass-assignment surface on that one route, while still reading as if
 * validation were in place.
 *
 * Every parameter-level pipe in this codebase must come from this file, so the
 * configuration cannot drift route by route. Enforced by the Semgrep rule
 * `nestjs-parameter-validation-pipe-must-be-shared`.
 *
 * If a route genuinely needs different options, add a named factory here with
 * the reason — do not inline a `new ValidationPipe(...)` at the call site.
 */

/**
 * The default for parameter-level validation: unknown properties are stripped
 * **and** rejected with 400. Matches the global pipe in `main.ts`.
 *
 * Use for every `@Body()` and for `@Query()` where clients are expected to
 * send only documented parameters.
 */
export const strictValidation = (): ValidationPipe =>
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

/**
 * Strips unknown properties without rejecting the request.
 *
 * Use only where an extra query parameter must not fail the call — public
 * endpoints that third-party clients, link shorteners, or analytics tooling
 * may decorate with their own parameters (`utm_*`, cache-busters). Unknown
 * values are still removed before they reach the DTO, so this is a
 * usability concession, not a security one.
 */
export const lenientValidation = (): ValidationPipe =>
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: false,
  });
