/**
 * Structural guard: every `@Cron` in the codebase must be locked.
 *
 * The per-job locks are applied by hand, one call site at a time, which means
 * the next person to add a scheduled job can simply forget — and nothing fails.
 * The job just quietly starts running on every replica, and for anything that
 * moves money or emits notifications that is a production incident nobody sees
 * coming.
 *
 * This test reads the source and fails on any `@Cron` whose method body does
 * not go through `cronLock.runExclusive`. It is deliberately a source scan
 * rather than a runtime check: the defect is "someone wrote a method", which
 * only exists in the text.
 *
 * If this fails, the fix is to wrap the new job — not to add it to an
 * allow-list. There is no allow-list on purpose.
 *
 * The scanner lives inline rather than in a helper module because Jest's
 * `testMatch` treats every file under `__tests__/` as a suite.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { CronLockName } from '../../constants/cron-lock.constant';

const SRC_ROOT = join(__dirname, '..', '..', '..');
const IGNORED_DIRS = new Set(['node_modules', 'dist', '__tests__', 'test']);

interface CronMethod {
  /** Path tail, for readable failure output. */
  file: string;
  /** 1-indexed line of the `@Cron(` decorator. */
  line: number;
  /** Method name the decorator is attached to. */
  name: string;
  /** Method body, from its opening brace to the matching close. */
  body: string;
}

/** Every non-test `.ts` file under `root`. */
function collectSourceFiles(root: string): string[] {
  const found: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);

      if (statSync(full).isDirectory()) {
        if (!IGNORED_DIRS.has(entry)) {
          walk(full);
        }
        continue;
      }

      if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts') && !entry.endsWith('.d.ts')) {
        found.push(full);
      }
    }
  };

  walk(root);
  return found;
}

/**
 * Extracts the body of the method following each `@Cron(...)` decorator.
 *
 * Brace matching starts at the first `{` after the decorator and counts to the
 * matching close, so nested blocks and the `runExclusive` callback are all
 * included — which is exactly what the coverage assertion needs to see.
 *
 * Deliberately text analysis: the codebase writes decorators in a consistent
 * style, and a full TypeScript AST parse would add a heavy dependency to prove
 * a property a brace counter can establish.
 */
function findCronMethods(filePath: string, contents: string): CronMethod[] {
  const methods: CronMethod[] = [];
  const decorator = /@Cron\(/g;
  let match: RegExpExecArray | null;

  while ((match = decorator.exec(contents)) !== null) {
    const afterDecorator = contents.slice(match.index);

    // Method signature sits on the line after the decorator's closing paren.
    const signature = /\n\s*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?(\w+)\s*\(/.exec(
      afterDecorator,
    );
    if (!signature) {
      continue;
    }

    const bodyStart = afterDecorator.indexOf('{', signature.index);
    if (bodyStart === -1) {
      continue;
    }

    let depth = 0;
    let bodyEnd = bodyStart;
    for (let i = bodyStart; i < afterDecorator.length; i++) {
      const char = afterDecorator[i];
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          bodyEnd = i;
          break;
        }
      }
    }

    methods.push({
      file: filePath.split(/[\\/]/).slice(-3).join('/'),
      line: contents.slice(0, match.index).split('\n').length,
      name: signature[1] ?? 'unknown',
      body: afterDecorator.slice(bodyStart, bodyEnd + 1),
    });
  }

  return methods;
}

describe('@Cron lock coverage', () => {
  const cronMethods = collectSourceFiles(SRC_ROOT).flatMap(file =>
    findCronMethods(file, readFileSync(file, 'utf8')),
  );

  it('finds the scheduled jobs (guards against a broken scanner)', () => {
    // If the scan silently matched nothing, every assertion below would pass
    // vacuously and the guard would be worthless.
    expect(cronMethods.length).toBeGreaterThanOrEqual(20);
  });

  it('every @Cron method delegates to cronLock.runExclusive', () => {
    const unlocked = cronMethods
      .filter(method => !method.body.includes('cronLock.runExclusive'))
      .map(method => `${method.file}:${method.line} → ${method.name}()`);

    expect(unlocked).toEqual([]);
  });

  it('every @Cron method uses a CronLockName constant, never a string literal', () => {
    // A literal is how two replicas end up with different keys for the same
    // job — a typo disables the lock and nothing reports it.
    const withLiteralKeys = cronMethods
      .filter(method => /runExclusive\(\s*['"`]/.test(method.body))
      .map(method => `${method.file}:${method.line} → ${method.name}()`);

    expect(withLiteralKeys).toEqual([]);
  });

  it('lock names are unique — no two jobs share a key', () => {
    // Two jobs sharing a name would mutually exclude each other, so one would
    // never run on a tick the other won.
    const names = Object.values(CronLockName);

    expect(new Set(names).size).toBe(names.length);
  });
});
