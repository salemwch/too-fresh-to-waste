import { requireMongoTestUri } from './mongo-test-uri';

describe('requireMongoTestUri', () => {
  const original = process.env['MONGO_TEST_URI'];

  afterEach(() => {
    if (original === undefined) {
      delete process.env['MONGO_TEST_URI'];
    } else {
      process.env['MONGO_TEST_URI'] = original;
    }
  });

  it('returns the URI when one is set', () => {
    process.env['MONGO_TEST_URI'] = 'mongodb://u:p@localhost:27017/admin';
    expect(requireMongoTestUri()).toBe('mongodb://u:p@localhost:27017/admin');
  });

  it('throws when the variable is absent, rather than inventing a credential', () => {
    delete process.env['MONGO_TEST_URI'];
    expect(() => requireMongoTestUri()).toThrow(/MONGO_TEST_URI is not set/);
  });

  it('throws when the variable is empty', () => {
    process.env['MONGO_TEST_URI'] = '';
    expect(() => requireMongoTestUri()).toThrow(/MONGO_TEST_URI is not set/);
  });

  it('throws when the variable is only whitespace', () => {
    process.env['MONGO_TEST_URI'] = '   ';
    expect(() => requireMongoTestUri()).toThrow(/MONGO_TEST_URI is not set/);
  });

  // The regression this file exists to prevent: a default that silently works
  // is how `admin:password123` became load-bearing across five suites.
  it('never falls back to a hardcoded credential', () => {
    delete process.env['MONGO_TEST_URI'];

    // Assert it threw *first*. Without this the two negative matches below
    // pass vacuously the moment a default is reintroduced, which is the
    // failure mode this test exists to catch.
    let message: string | undefined;
    try {
      const returned = requireMongoTestUri();
      throw new Error(`expected a throw, got a fallback URI: ${returned}`);
    } catch (err) {
      message = (err as Error).message;
    }

    expect(message).toMatch(/MONGO_TEST_URI is not set/);
    expect(message).not.toMatch(/password123/);
    // no `scheme://user:pass@` literal anywhere in the guidance
    expect(message).not.toMatch(/mongodb:\/\/[^$\s]*:[^$@\s]+@/);
  });
});
