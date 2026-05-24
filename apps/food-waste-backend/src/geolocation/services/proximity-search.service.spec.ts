import { RegexSecurityUtil } from '../../common/utils/regex-security.util';

describe('RegexSecurityUtil — buildMultiFieldSearch field coverage for proximity search', () => {
  let regexUtil: RegexSecurityUtil;

  beforeEach(() => {
    regexUtil = new RegexSecurityUtil();
  });

  it('buildMultiFieldSearch includes name, address.city, and address.street', () => {
    const fields = regexUtil.buildMultiFieldSearch('sahloul', [
      'name',
      'address.city',
      'address.street',
    ]);

    const fieldNames = fields.map(f => Object.keys(f)[0]);
    expect(fieldNames).toContain('name');
    expect(fieldNames).toContain('address.city');
    expect(fieldNames).toContain('address.street');
    expect(fields).toHaveLength(3);
  });

  it('each field has a case-insensitive regex matching the query', () => {
    const fields = regexUtil.buildMultiFieldSearch('Msaken', ['name', 'address.city']);

    for (const fieldQuery of fields) {
      const regexObj = Object.values(fieldQuery)[0]!;
      expect(regexObj.$options).toBe('i');
      expect(regexObj.$regex).toBe('Msaken');
    }
  });

  it('returns empty array for empty query', () => {
    const fields = regexUtil.buildMultiFieldSearch('', ['name', 'address.city']);
    expect(fields).toHaveLength(0);
  });

  it('escapes special regex characters in the query before placing in $regex', () => {
    const fields = regexUtil.buildMultiFieldSearch('Café+', ['name', 'address.city']);

    for (const fieldQuery of fields) {
      const regexObj = Object.values(fieldQuery)[0]!;
      // '+' is a regex special char — must be escaped to '\+'
      expect(regexObj.$regex).toBe('Café\\+');
      expect(regexObj.$options).toBe('i');
    }
  });
});
