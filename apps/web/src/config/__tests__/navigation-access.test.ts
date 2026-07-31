import { UserRole } from '@foodwaste/shared';

import {
  adminNavGroups,
  filterNavGroupsByRole,
  isNavPathAllowedForRole,
} from '../navigation.config';

import type { NavGroup } from '../navigation.config';

/**
 * The admin shell used to hand every nav entry to the sidebar regardless of who
 * was signed in, so a moderator saw all 23 destinations when the backend grants
 * them 6 — every extra one leading to a 403 from a screen that looked available.
 *
 * These two functions are the fix. They are presentation, not protection: the
 * real gate is the backend's @Roles guards. What they must guarantee is that the
 * interface never promises authority the server will refuse, and — just as
 * importantly — never withholds authority it would have granted.
 */

const icon = (() => null) as unknown as NavGroup['items'][number]['icon'];

function group(groupKey: string, items: Array<[string, string, UserRole[]]>): NavGroup {
  return {
    groupKey,
    items: items.map(([titleKey, href, roles]) => ({ titleKey, href, icon, roles })),
  };
}

const FIXTURE: NavGroup[] = [
  group('overview', [
    ['dashboard', '/admin/dashboard', [UserRole.ADMIN, UserRole.MODERATOR]],
    ['analytics', '/admin/analytics', [UserRole.ADMIN]],
  ]),
  group('finance', [['payments', '/admin/payments', [UserRole.ADMIN]]]),
  group('community', [['moderation', '/admin/moderation', [UserRole.ADMIN, UserRole.MODERATOR]]]),
];

describe('filterNavGroupsByRole', () => {
  it('gives an admin every destination', () => {
    const result = filterNavGroupsByRole(FIXTURE, UserRole.ADMIN);
    expect(result.flatMap(g => g.items).map(i => i.titleKey)).toEqual([
      'dashboard',
      'analytics',
      'payments',
      'moderation',
    ]);
  });

  it('gives a moderator only what their role names', () => {
    const result = filterNavGroupsByRole(FIXTURE, UserRole.MODERATOR);
    expect(result.flatMap(g => g.items).map(i => i.titleKey)).toEqual(['dashboard', 'moderation']);
  });

  it('drops a group once nothing in it survives', () => {
    // 'finance' holds one admin-only entry, so a moderator must not be shown an
    // empty section header.
    const keys = filterNavGroupsByRole(FIXTURE, UserRole.MODERATOR).map(g => g.groupKey);
    expect(keys).toEqual(['overview', 'community']);
    expect(keys).not.toContain('finance');
  });

  it('shows nothing before the signed-in user is known', () => {
    // Auth rehydrates after first paint; rendering the full menu in that gap
    // would flash admin-only links at a moderator.
    expect(filterNavGroupsByRole(FIXTURE, undefined)).toEqual([]);
  });

  it('shows nothing to a role the admin nav does not serve', () => {
    expect(filterNavGroupsByRole(FIXTURE, UserRole.CONSUMER)).toEqual([]);
    expect(filterNavGroupsByRole(FIXTURE, UserRole.MERCHANT)).toEqual([]);
    expect(filterNavGroupsByRole(FIXTURE, UserRole.DRIVER)).toEqual([]);
  });

  it('leaves the source groups untouched', () => {
    // The config is module state shared by every render; filtering must copy.
    const before = JSON.stringify(FIXTURE.map(g => g.items.length));
    filterNavGroupsByRole(FIXTURE, UserRole.MODERATOR);
    expect(JSON.stringify(FIXTURE.map(g => g.items.length))).toBe(before);
  });
});

describe('isNavPathAllowedForRole', () => {
  it('lets a role open a section it owns', () => {
    expect(isNavPathAllowedForRole(FIXTURE, '/admin/moderation', UserRole.MODERATOR)).toBe(true);
    expect(isNavPathAllowedForRole(FIXTURE, '/admin/payments', UserRole.ADMIN)).toBe(true);
  });

  it('refuses a typed URL the role has no entry for', () => {
    // The link is hidden, but nothing stopped someone pasting the address.
    expect(isNavPathAllowedForRole(FIXTURE, '/admin/payments', UserRole.MODERATOR)).toBe(false);
    expect(isNavPathAllowedForRole(FIXTURE, '/admin/analytics', UserRole.MODERATOR)).toBe(false);
  });

  it('applies a section rule to its detail routes', () => {
    expect(isNavPathAllowedForRole(FIXTURE, '/admin/payments/42', UserRole.MODERATOR)).toBe(false);
    expect(isNavPathAllowedForRole(FIXTURE, '/admin/moderation/7/reply', UserRole.MODERATOR)).toBe(
      true,
    );
  });

  it('does not treat a shared prefix as the same section', () => {
    // /admin/payments-export is a different route, not a child of /admin/payments.
    expect(isNavPathAllowedForRole(FIXTURE, '/admin/payments-export', UserRole.MODERATOR)).toBe(
      true,
    );
  });

  it('prefers the most specific entry when two could match', () => {
    const nested = [
      ...FIXTURE,
      group('nested', [['reports', '/admin/moderation/reports', [UserRole.ADMIN]]]),
    ];
    // /admin/moderation would allow a moderator; the deeper admin-only entry wins.
    expect(isNavPathAllowedForRole(nested, '/admin/moderation/reports', UserRole.MODERATOR)).toBe(
      false,
    );
    expect(isNavPathAllowedForRole(nested, '/admin/moderation/queue', UserRole.MODERATOR)).toBe(
      true,
    );
  });

  it('allows a route no entry claims', () => {
    // The nav is not an exhaustive route table. Denying by default would lock
    // people out of any page nobody remembered to add to the menu.
    expect(isNavPathAllowedForRole(FIXTURE, '/admin/some-unlisted-tool', UserRole.MODERATOR)).toBe(
      true,
    );
  });

  it('refuses everything until the signed-in user is known', () => {
    expect(isNavPathAllowedForRole(FIXTURE, '/admin/dashboard', undefined)).toBe(false);
  });
});

describe('the real admin navigation', () => {
  it('never offers a moderator more than the six sections they are granted', () => {
    const visible = filterNavGroupsByRole(adminNavGroups, UserRole.MODERATOR).flatMap(g => g.items);
    expect(visible).toHaveLength(6);
    expect(visible.map(i => i.titleKey).sort()).toEqual([
      'announcements',
      'dashboard',
      'establishments',
      'moderation',
      'supportTickets',
      'users',
    ]);
  });

  it('keeps every destination for an admin', () => {
    const all = adminNavGroups.flatMap(g => g.items);
    const visible = filterNavGroupsByRole(adminNavGroups, UserRole.ADMIN).flatMap(g => g.items);
    expect(visible).toHaveLength(all.length);
  });

  it('agrees with itself — a hidden link is also a blocked URL', () => {
    // The two functions read the same `roles` field, so they cannot disagree.
    // This is the property that keeps a future edit to one from silently
    // diverging from the other.
    const visible = new Set(
      filterNavGroupsByRole(adminNavGroups, UserRole.MODERATOR)
        .flatMap(g => g.items)
        .map(i => i.href),
    );

    for (const item of adminNavGroups.flatMap(g => g.items)) {
      expect(isNavPathAllowedForRole(adminNavGroups, item.href, UserRole.MODERATOR)).toBe(
        visible.has(item.href),
      );
    }
  });

  it('lands a redirected moderator somewhere they are allowed', () => {
    // The shell sends refusals to /admin/dashboard; if that were admin-only the
    // redirect would loop.
    expect(isNavPathAllowedForRole(adminNavGroups, '/admin/dashboard', UserRole.MODERATOR)).toBe(
      true,
    );
  });
});
