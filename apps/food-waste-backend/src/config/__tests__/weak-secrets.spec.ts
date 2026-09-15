import { describeWeakSecret, KNOWN_DEV_SECRETS } from '../weak-secrets';

describe('describeWeakSecret', () => {
  it('accepts a real random secret', () => {
    const strong = 'a3f9c1e07b2d8456af90c3e1b7d264809fbc3e5a1d7024689acf3b1e5d708246';
    expect(describeWeakSecret(strong)).toBeNull();
  });

  it.each(KNOWN_DEV_SECRETS)('rejects the committed development literal %s', literal => {
    expect(describeWeakSecret(literal)).toMatch(/known development secret/);
  });

  // The exact regression: this value is 42 chars and passed the old min(32).
  it('rejects the docker-compose JWT secret that passed the old length check', () => {
    const shipped = 'dev_jwt_secret_please_change_in_production';
    expect(shipped.length).toBeGreaterThan(32);
    expect(describeWeakSecret(shipped)).not.toBeNull();
  });

  it('is case-insensitive and trims', () => {
    expect(describeWeakSecret('  DEV_JWT_SECRET_PLEASE_CHANGE_IN_PRODUCTION  ')).not.toBeNull();
  });

  it.each([
    'CHANGE_ME_generate_with_the_command_above',
    'your_secret_here_padded_out_to_thirty_two',
    'placeholder_value_padded_out_to_32_chars_x',
    'insecure_dev_value_padded_out_to_32_chars',
  ])('rejects unreplaced placeholder %s', value => {
    expect(describeWeakSecret(value)).toMatch(/placeholder/);
  });

  it('rejects a long string with almost no distinct characters', () => {
    expect(describeWeakSecret('a'.repeat(64))).toMatch(/too few distinct characters/);
  });

  it('rejects an empty string', () => {
    expect(describeWeakSecret('')).toMatch(/is empty/);
  });

  it('does not reject a hex secret merely for containing common words', () => {
    // 'decade' and 'faced' are spellable in hex; they must not trip the filter.
    const hex = 'decadefacedbeef0123456789abcdef0123456789abcdef0123456789abcdef0';
    expect(describeWeakSecret(hex)).toBeNull();
  });
});
