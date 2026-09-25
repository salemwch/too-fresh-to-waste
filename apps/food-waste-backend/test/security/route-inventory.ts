/**
 * Static route inventory for the authorization matrix.
 *
 * Walks every `*.controller.ts` with the TypeScript compiler API and records,
 * per route, the decorators that actually govern access — class-level and
 * method-level combined, because NestJS applies both.
 *
 * @rationale This backend registers **no `APP_GUARD`**. Authentication is
 * opt-in per controller or route via `@UseGuards(JwtAuthGuard)`. That inverts
 * the usual failure mode: a route that simply forgets the decorator is not
 * "protected by default and explicitly opened", it is silently open. Nothing
 * in the type system, the linter, or the test suite notices. This inventory
 * exists so `authorization.spec.ts` can notice.
 *
 * Regex was not used deliberately — decorators span lines, nest arguments, and
 * appear at two levels. The AST is the only reliable reading of them.
 */

import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

/** HTTP method decorators NestJS recognises. */
const HTTP_DECORATORS = new Set([
  'Get',
  'Post',
  'Put',
  'Patch',
  'Delete',
  'All',
  'Head',
  'Options',
]);

export interface RouteRecord {
  /** e.g. `GET /orders/:id` — stable identity used by the baseline. */
  readonly id: string;
  readonly httpMethod: string;
  readonly routePath: string;
  readonly controller: string;
  /** Repo-relative, POSIX separators, so it is stable across machines. */
  readonly file: string;
  readonly handler: string;
  /** Guard class names from `@UseGuards(...)`, class + method level. */
  readonly guards: readonly string[];
  /** Role arguments from `@Roles(...)`, class + method level. */
  readonly roles: readonly string[];
  readonly isPublic: boolean;
  readonly hasThrottle: boolean;
}

function decoratorsOf(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

/** `@Foo(...)` -> `Foo`; `@Foo` -> `Foo`. */
function decoratorName(dec: ts.Decorator): string {
  const expr = ts.isCallExpression(dec.expression) ? dec.expression.expression : dec.expression;
  return ts.isIdentifier(expr) ? expr.text : expr.getText();
}

function decoratorArgs(dec: ts.Decorator): readonly ts.Expression[] {
  return ts.isCallExpression(dec.expression) ? dec.expression.arguments : [];
}

/** First argument as a literal string, when it is one. */
function firstStringArg(dec: ts.Decorator): string | undefined {
  const [arg] = decoratorArgs(dec);
  return arg && ts.isStringLiteral(arg) ? arg.text : undefined;
}

/** Renders each argument as source text — `UserRole.ADMIN`, `JwtAuthGuard`, … */
function argTexts(dec: ts.Decorator): string[] {
  return decoratorArgs(dec).map(a => a.getText().trim());
}

function joinPath(prefix: string, suffix: string): string {
  const clean = (s: string) => s.replace(/^\/+|\/+$/g, '');
  const parts = [clean(prefix), clean(suffix)].filter(Boolean);
  return `/${parts.join('/')}`;
}

function collectFromFile(absFile: string, repoRoot: string): RouteRecord[] {
  const source = fs.readFileSync(absFile, 'utf-8');
  const sf = ts.createSourceFile(
    absFile,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );
  const relFile = path.relative(repoRoot, absFile).split(path.sep).join('/');

  const routes: RouteRecord[] = [];

  for (const stmt of sf.statements) {
    if (!ts.isClassDeclaration(stmt) || !stmt.name) {
      continue;
    }

    const classDecorators = decoratorsOf(stmt);
    const controllerDec = classDecorators.find(d => decoratorName(d) === 'Controller');
    if (!controllerDec) {
      continue;
    }

    const controllerName = stmt.name.text;
    const prefix = firstStringArg(controllerDec) ?? '';

    // Class-level access decorators cascade to every route in the controller.
    const classGuards = classDecorators
      .filter(d => decoratorName(d) === 'UseGuards')
      .flatMap(argTexts);
    const classRoles = classDecorators.filter(d => decoratorName(d) === 'Roles').flatMap(argTexts);
    const classPublic = classDecorators.some(d => decoratorName(d) === 'Public');

    for (const member of stmt.members) {
      if (!ts.isMethodDeclaration(member) || !member.name) {
        continue;
      }

      const methodDecorators = decoratorsOf(member);
      const httpDec = methodDecorators.find(d => HTTP_DECORATORS.has(decoratorName(d)));
      if (!httpDec) {
        continue;
      }

      const httpMethod = decoratorName(httpDec).toUpperCase();
      const routePath = joinPath(prefix, firstStringArg(httpDec) ?? '');

      const guards = [
        ...classGuards,
        ...methodDecorators.filter(d => decoratorName(d) === 'UseGuards').flatMap(argTexts),
      ];
      const roles = [
        ...classRoles,
        ...methodDecorators.filter(d => decoratorName(d) === 'Roles').flatMap(argTexts),
      ];

      routes.push({
        id: `${httpMethod} ${routePath}`,
        httpMethod,
        routePath,
        controller: controllerName,
        file: relFile,
        handler: member.name.getText(),
        guards: [...new Set(guards)],
        roles: [...new Set(roles)],
        isPublic: classPublic || methodDecorators.some(d => decoratorName(d) === 'Public'),
        hasThrottle: methodDecorators.some(d => decoratorName(d) === 'Throttle'),
      });
    }
  }

  return routes;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      walk(full, out);
    } else if (entry.name.endsWith('.controller.ts') && !entry.name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Every HTTP route declared in the backend, sorted by id for stable output. */
export function collectRoutes(): RouteRecord[] {
  const backendRoot = path.resolve(__dirname, '../..');
  const srcRoot = path.join(backendRoot, 'src');
  return walk(srcRoot)
    .flatMap(file => collectFromFile(file, backendRoot))
    .sort((a, b) =>
      a.id === b.id ? a.controller.localeCompare(b.controller) : a.id < b.id ? -1 : 1,
    );
}

/** Guards that establish caller identity. A route with none is unauthenticated. */
export const AUTHENTICATING_GUARDS = [
  'JwtAuthGuard',
  'JwtRefreshGuard',
  'LocalAuthGuard',
  'WebSocketAuthGuard',
  'ApiKeyGuard',
] as const;

export function isAuthenticated(route: RouteRecord): boolean {
  return route.guards.some(g => (AUTHENTICATING_GUARDS as readonly string[]).includes(g));
}
