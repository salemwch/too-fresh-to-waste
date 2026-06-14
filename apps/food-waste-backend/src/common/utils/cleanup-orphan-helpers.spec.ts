/**
 * Unit tests for safeToString and orphan filtering logic.
 * The cleanup script uses safeToString to handle null/undefined/corrupt references.
 */

function safeToString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  try {
    return String(value);
  } catch {
    return null;
  }
}

describe('cleanup-orphaned-data: safeToString', () => {
  it('should return null for null', () => {
    expect(safeToString(null)).toBeNull();
  });

  it('should return null for undefined', () => {
    expect(safeToString(undefined)).toBeNull();
  });

  it('should convert ObjectId-like string', () => {
    expect(safeToString('507f1f77bcf86cd799439011')).toBe('507f1f77bcf86cd799439011');
  });

  it('should convert numbers', () => {
    expect(safeToString(123)).toBe('123');
  });

  it('should handle objects with toString', () => {
    const obj = { toString: () => '507f1f77bcf86cd799439011' };
    expect(safeToString(obj)).toBe('507f1f77bcf86cd799439011');
  });

  it('should return null for objects with broken toString', () => {
    const obj = {
      toString: () => {
        throw new Error('broken');
      },
    };
    expect(safeToString(obj)).toBeNull();
  });
});

describe('cleanup-orphaned-data: orphan detection', () => {
  const validUserIds = new Set(['user-1', 'user-2', 'user-3']);

  function isOrphan(doc: { userId: unknown }): boolean {
    const id = safeToString(doc.userId);
    return !id || !validUserIds.has(id);
  }

  it('should detect orphan when userId is null', () => {
    expect(isOrphan({ userId: null })).toBe(true);
  });

  it('should detect orphan when userId is undefined', () => {
    expect(isOrphan({ userId: undefined })).toBe(true);
  });

  it('should detect orphan when userId references a deleted user', () => {
    expect(isOrphan({ userId: 'deleted-user' })).toBe(true);
  });

  it('should NOT detect orphan when userId is valid', () => {
    expect(isOrphan({ userId: 'user-1' })).toBe(false);
  });

  it('should detect orphan when userId is an empty string', () => {
    expect(isOrphan({ userId: '' })).toBe(true);
  });

  it('should detect orphan when userId is 0 (falsy but not null)', () => {
    // safeToString(0) returns '0', which won't be in validUserIds
    expect(isOrphan({ userId: 0 })).toBe(true);
  });
});
