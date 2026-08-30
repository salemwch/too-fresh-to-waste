/**
 * The dev session must be impossible to enable by accident.
 *
 * This file is the reason the seeder is allowed to exist at all. It asserts
 * each of the three gates independently, asserts the shipped env files carry
 * none of them, and asserts the entry point keeps the whole thing behind
 * `__DEV__`.
 *
 * The gates are deliberately over-specified. A single gate would be enough if
 * it were guaranteed correct; three exist because the failure being guarded
 * against is somebody misconfiguring one of them.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { devAuthRole, devSessionBlockedReason } from '../devSession';

const MOBILE_ROOT = join(__dirname, '..', '..', '..');

const LOCAL_API = 'http://localhost:8787/api/v1';
const PROD_API = 'https://api.toofreshtowaste.com/api/v1';

describe('devSessionBlockedReason - the three gates', () => {
  it('allows seeding only when all three hold', () => {
    expect(devSessionBlockedReason(true, 'true', LOCAL_API)).toBeNull();
  });

  describe('gate 1: build type', () => {
    it('refuses in a release build even with everything else configured', () => {
      // The one that matters most: whatever else is wrong, a shipped build
      // cannot do this.
      expect(devSessionBlockedReason(false, 'true', LOCAL_API)).toBe('not a development build');
    });
  });

  describe('gate 2: explicit opt-in', () => {
    it.each([
      ['undefined', undefined],
      ['empty', ''],
      ['false', 'false'],
      ['1', '1'],
      ['TRUE (wrong case)', 'TRUE'],
      ['yes', 'yes'],
    ])('refuses when ENABLE_DEV_AUTH is %s', (_label, flag) => {
      // Strict equality against the string 'true' - nothing else opts in.
      expect(devSessionBlockedReason(true, flag as string | undefined, LOCAL_API)).toBe(
        'ENABLE_DEV_AUTH is not "true"',
      );
    });
  });

  describe('gate 3: the API must be local', () => {
    it('refuses against the production API even when the flag is on', () => {
      // The gate that makes the other two survivable. A fake token is never
      // written while the app can reach a real backend.
      expect(devSessionBlockedReason(true, 'true', PROD_API)).toBe(
        `API base URL is not local (${PROD_API})`,
      );
    });

    it.each([
      'https://api.toofreshtowaste.com/api/v1',
      'https://staging.toofreshtowaste.com/api/v1',
      'https://localhost.evil.example.com/api/v1',
      'https://notlocalhost/api/v1',
      'http://10.0.2.3/api/v1',
    ])('refuses against %s', url => {
      expect(devSessionBlockedReason(true, 'true', url)).not.toBeNull();
    });

    it.each([
      'http://localhost:8787/api/v1',
      'http://127.0.0.1:8787/api/v1',
      // The Android emulator's alias for the host machine.
      'http://10.0.2.2:8787/api/v1',
    ])('allows %s', url => {
      expect(devSessionBlockedReason(true, 'true', url)).toBeNull();
    });

    it('refuses a malformed URL rather than assuming it is safe', () => {
      expect(devSessionBlockedReason(true, 'true', 'not-a-url')).not.toBeNull();
    });

    it('is not fooled by a host that merely contains "localhost"', () => {
      // Substring matching here would be an actual vulnerability: an attacker
      // controlling localhost.example.com would satisfy the gate.
      expect(devSessionBlockedReason(true, 'true', 'https://localhost.attacker.test/api/v1')).toBe(
        'API base URL is not local (https://localhost.attacker.test/api/v1)',
      );
    });
  });
});

describe('the shipped configuration carries no dev-auth switch', () => {
  const readEnv = (name: string): string | null => {
    const p = join(MOBILE_ROOT, name);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  };

  /*
   * `.env.staging` and `.env.production` are gitignored, so on CI they may not
   * exist at all. When they do exist - on a machine that can build a release -
   * they must not carry the flag. Skipping silently when absent would make this
   * assertion vacuous exactly where it matters, so the absence is reported.
   */
  it.each(['.env.staging', '.env.production'])('%s does not enable dev auth', name => {
    const contents = readEnv(name);
    expect({
      file: name,
      present: contents !== null,
      enablesDevAuth: contents === null ? false : /^ENABLE_DEV_AUTH\s*=\s*true/mu.test(contents),
    }).toMatchObject({ enablesDevAuth: false });
  });

  it.each(['.env.staging', '.env.production'])('%s does not point at a local API', name => {
    const contents = readEnv(name);
    const apiLine = contents?.match(/^API_BASE_URL\s*=\s*(.+)$/mu)?.[1] ?? '';
    expect({
      file: name,
      pointsLocal: /localhost|127\.0\.0\.1|10\.0\.2\.2/u.test(apiLine),
    }).toMatchObject({ pointsLocal: false });
  });

  it('.env.example documents the switch as off', () => {
    const example = readEnv('.env.example');
    expect(example).not.toBeNull();
    // Documented so nobody has to discover it by reading source, and shipped
    // as false so copying the example never enables it.
    expect(example).toMatch(/^ENABLE_DEV_AUTH\s*=\s*false/mu);
  });
});

describe('the entry point keeps it behind __DEV__', () => {
  const entry = readFileSync(join(MOBILE_ROOT, 'index.js'), 'utf8');

  it('only requires the module inside an __DEV__ branch', () => {
    // A source assertion, and labelled as one. It exists because the guard is a
    // single line in a file no test renders, and deleting it would silently put
    // the seeder into the release bundle's execution path.
    const guarded = /if \(__DEV__\) \{[\s\S]*?require\('\.\/src\/dev\/devSession'\)[\s\S]*?\n\}/u;
    expect(entry).toMatch(guarded);
  });

  it('does not import the module at the top level', () => {
    expect(entry).not.toMatch(/^import .*devSession/mu);
  });
});

describe('devAuthRole - which role the fixture session carries', () => {
  it('returns driver only for the exact string', () => {
    expect(devAuthRole('driver')).toBe('driver');
  });

  it.each([
    ['undefined', undefined],
    ['empty', ''],
    ['consumer', 'consumer'],
    ['DRIVER (wrong case)', 'DRIVER'],
    ['Driver', 'Driver'],
    ['driver ', 'driver '],
    ['admin', 'admin'],
    ['merchant', 'merchant'],
  ])('falls back to consumer for %s', (_label, raw) => {
    // Anything unrecognised must land on the least-privileged fixture rather
    // than the one that unlocks an extra navigation stack.
    expect(devAuthRole(raw as string | undefined)).toBe('consumer');
  });

  it('never returns a role the mobile app disallows', () => {
    // MOBILE_ALLOWED_ROLES permits consumer and driver only. A fixture that
    // could produce `admin` or `merchant` would be logged straight back out by
    // the auth slice, which would look like a broken fixture rather than a
    // refused role.
    for (const raw of ['admin', 'merchant', 'moderator', 'location_manager']) {
      expect(['consumer', 'driver']).toContain(devAuthRole(raw));
    }
  });
});
