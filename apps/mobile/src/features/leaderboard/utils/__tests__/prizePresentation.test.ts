import { PrizeCategory } from '@foodwaste/shared';

import { getBallotPrizeRows, getGrandPrizePresentation } from '../prizePresentation';

import type { PrizeOption, VotingCycleData } from '@/features/voting/types/voting.types';

/**
 * The leaderboard hardcoded 📱 "Smartphone" in the tier card and the info modal.
 * A phone is one of six categories the community can elect, so a season that
 * chose a hotel stay still announced a smartphone — and the winner modal, which
 * does read the real name, then contradicted the screens that led there.
 *
 * These two functions resolve what to show. What they must never do is name a
 * prize the vote has not chosen: a user plans around what the card says.
 */

function prize(over: Partial<PrizeOption> & { _id: string }): PrizeOption {
  return {
    name: 'Prize',
    description: '',
    imageUrl: '',
    category: PrizeCategory.PHONE,
    value: '',
    ...over,
  };
}

function cycle(over: Partial<VotingCycleData> = {}): VotingCycleData {
  return {
    _id: 'cycle-1',
    name: 'Saison 1',
    status: 'ACTIVE',
    cycleStartDate: '2026-07-01T00:00:00.000Z',
    cycleEndDate: '2026-07-31T00:00:00.000Z',
    seasonBagTarget: 500,
    seasonBagProgress: 120,
    ballotOpensAt: null,
    ballotClosesAt: null,
    prizes: [],
    winner: null,
    recipientCount: 3,
    minimumBags: 1,
    ...over,
  } as VotingCycleData;
}

const BALLOT: PrizeOption[] = [
  prize({ _id: 'p1', name: 'iPhone 15', category: PrizeCategory.PHONE, value: '2 800 DT' }),
  prize({ _id: 'p2', name: '5 nuits à Hammamet', category: PrizeCategory.HOTEL_STAY }),
  prize({ _id: 'p3', name: 'Bon d’achat', category: PrizeCategory.SHOPPING_VOUCHER }),
  prize({ _id: 'p4', name: '1 an de salle', category: PrizeCategory.GYM_MEMBERSHIP }),
  prize({ _id: 'p5', name: 'Trottinette', category: PrizeCategory.ELECTRIC_SCOOTER }),
];

function winner(prizeId: string, name: string) {
  return {
    prizeId,
    name,
    totalWeightedVotes: 10,
    voterCount: 4,
    announcedAt: '2026-07-20T00:00:00.000Z',
  };
}

describe('getGrandPrizePresentation', () => {
  it('shows the elected prize with the icon for its category', () => {
    const result = getGrandPrizePresentation(
      cycle({ prizes: BALLOT, winner: winner('p5', 'Trottinette') }),
      EN,
    );
    expect(result).toEqual({ icon: '🛴', name: 'Trottinette' });
  });

  it.each([
    [PrizeCategory.PHONE, '📱'],
    [PrizeCategory.HOTEL_STAY, '🏨'],
    [PrizeCategory.SHOPPING_VOUCHER, '🎫'],
    [PrizeCategory.GYM_MEMBERSHIP, '🏋️'],
    [PrizeCategory.ELECTRIC_SCOOTER, '🛴'],
    [PrizeCategory.CUSTOM, '🏆'],
  ])('gives %s its own icon', (category, icon) => {
    const only = prize({ _id: 'x', name: 'Lot', category });
    const result = getGrandPrizePresentation(
      cycle({ prizes: [only], winner: winner('x', 'Lot') }),
      EN,
    );
    expect(result.icon).toBe(icon);
  });

  describe('names nothing until the season has decided', () => {
    // The card falls back to a translated "community's choice" on a null name.
    // Inventing a prize here would be worse than showing none.

    it('when no cycle is loaded', () => {
      expect(getGrandPrizePresentation(undefined, EN)).toEqual({ icon: '🏆', name: null });
      expect(getGrandPrizePresentation(null, EN)).toEqual({ icon: '🏆', name: null });
    });

    it('when the ballot is still open', () => {
      expect(getGrandPrizePresentation(cycle({ prizes: BALLOT, winner: null }), EN)).toEqual({
        icon: '🏆',
        name: null,
      });
    });

    it('when the winner record carries a blank name', () => {
      expect(
        getGrandPrizePresentation(cycle({ prizes: BALLOT, winner: winner('p1', '   ') }), EN).name,
      ).toBeNull();
    });
  });

  it('still names the prize when its ballot entry is gone', () => {
    // The name lives on the winner record; only the icon needs the ballot. An
    // admin editing the prize list must not blank the announced winner.
    const result = getGrandPrizePresentation(
      cycle({ prizes: [], winner: winner('deleted', 'Trottinette') }),
      EN,
    );
    expect(result).toEqual({ icon: '🏆', name: 'Trottinette' });
  });

  describe('the announced winner reads in the user language too', () => {
    // The winner record snapshots the name at announcement and carries no
    // translations, so the variants only exist on the ballot entry.
    const elected = prize({
      _id: 'pw',
      name: 'Latest Smartphone',
      nameI18n: { ar: 'أحدث هاتف ذكي' },
      category: PrizeCategory.PHONE,
    });
    const decided = cycle({ prizes: [elected], winner: winner('pw', 'Latest Smartphone') });

    it('resolves the winner name from the ballot entry', () => {
      expect(getGrandPrizePresentation(decided, 'ar').name).toBe('أحدث هاتف ذكي');
    });

    it('keeps the default for a language with no variant', () => {
      expect(getGrandPrizePresentation(decided, 'fr').name).toBe('Latest Smartphone');
    });

    it('still names the prize when the ballot entry was deleted', () => {
      // Nothing left to resolve from, so the snapshot stands - naming the
      // prize beats blanking a result the season already decided.
      const orphaned = cycle({ prizes: [], winner: winner('gone', 'Trottinette') });
      expect(getGrandPrizePresentation(orphaned, 'ar').name).toBe('Trottinette');
    });
  });
  it('falls back to the trophy for a category it does not know', () => {
    const odd = prize({ _id: 'x', name: 'Lot', category: 'SOMETHING_NEW' as PrizeCategory });
    const result = getGrandPrizePresentation(
      cycle({ prizes: [odd], winner: winner('x', 'Lot') }),
      EN,
    );
    expect(result).toEqual({ icon: '🏆', name: 'Lot' });
  });

  it('trims a padded name rather than rendering the padding', () => {
    expect(
      getGrandPrizePresentation(
        cycle({ prizes: BALLOT, winner: winner('p1', '  iPhone 15  ') }),
        EN,
      ).name,
    ).toBe('iPhone 15');
  });
});

/** Prize rows resolve admin-authored text, so every call needs a reader. */
const EN = 'en';

describe('getBallotPrizeRows', () => {
  it('lists every prize on the ballot with its own icon', () => {
    const rows = getBallotPrizeRows(cycle({ prizes: BALLOT }), EN);
    expect(rows.map(r => r.name)).toEqual([
      'iPhone 15',
      '5 nuits à Hammamet',
      'Bon d’achat',
      '1 an de salle',
      'Trottinette',
    ]);
    expect(rows.map(r => r.icon)).toEqual(['📱', '🏨', '🎫', '🏋️', '🛴']);
  });

  it('marks the elected prize and only that one', () => {
    const rows = getBallotPrizeRows(
      cycle({ prizes: BALLOT, winner: winner('p2', 'Hammamet') }),
      EN,
    );
    expect(rows.filter(r => r.isElected).map(r => r.id)).toEqual(['p2']);
  });

  it('marks nothing while the ballot is open', () => {
    const rows = getBallotPrizeRows(cycle({ prizes: BALLOT, winner: null }), EN);
    expect(rows.some(r => r.isElected)).toBe(false);
  });

  it('carries the admin-entered worth through, blank when there is none', () => {
    const rows = getBallotPrizeRows(cycle({ prizes: BALLOT }), EN);
    expect(rows[0]?.value).toBe('2 800 DT');
    expect(rows[1]?.value).toBe('');
  });

  it('drops entries with no usable name', () => {
    // The modal renders one row per entry; a nameless row is a blank line.
    const rows = getBallotPrizeRows(
      cycle({ prizes: [...BALLOT, prize({ _id: 'p6', name: '   ' })] }),
      EN,
    );
    expect(rows).toHaveLength(BALLOT.length);
    expect(rows.every(r => r.name.length > 0)).toBe(true);
  });

  it('returns nothing when there is no cycle or no ballot', () => {
    // The modal then omits the section rather than drawing an empty box.
    expect(getBallotPrizeRows(undefined, EN)).toEqual([]);
    expect(getBallotPrizeRows(null, EN)).toEqual([]);
    expect(getBallotPrizeRows(cycle({ prizes: [] }), EN)).toEqual([]);
  });

  it('grows with the ballot — a sixth prize needs no app release', () => {
    const sixth = prize({ _id: 'p6', name: 'Vélo', category: PrizeCategory.CUSTOM });
    expect(getBallotPrizeRows(cycle({ prizes: [...BALLOT, sixth] }), EN)).toHaveLength(6);
  });

  describe('admin-supplied translations', () => {
    // Prize names are content an admin types, not chrome we ship, so they
    // cannot live in the locale files. An admin may add French and Arabic
    // variants; everyone else must still see something.
    const translated = prize({
      _id: 'pt',
      name: 'Latest Smartphone',
      nameI18n: { fr: 'Dernier smartphone', ar: 'أحدث هاتف ذكي' },
    });

    it.each([
      ['en', 'Latest Smartphone'],
      ['fr', 'Dernier smartphone'],
      ['ar', 'أحدث هاتف ذكي'],
    ])('shows the %s reader their own variant', (locale, expected) => {
      const [row] = getBallotPrizeRows(cycle({ prizes: [translated] }), locale);
      expect(row?.name).toBe(expected);
    });

    it('falls back to the default when the admin supplied no variant', () => {
      // Every cycle created before the field existed is in this state, and so
      // is any prize whose admin did not bother.
      const plain = prize({ _id: 'pp', name: 'Latest Smartphone' });
      const [row] = getBallotPrizeRows(cycle({ prizes: [plain] }), 'ar');
      expect(row?.name).toBe('Latest Smartphone');
    });

    it('falls back when only the other language was supplied', () => {
      const frOnly = prize({ _id: 'pf', name: 'Latest Smartphone', nameI18n: { fr: 'Dernier' } });
      const [row] = getBallotPrizeRows(cycle({ prizes: [frOnly] }), 'ar');
      expect(row?.name).toBe('Latest Smartphone');
    });

    it('treats a blank variant as not supplied', () => {
      // An admin who opened the Arabic field, typed nothing and saved has not
      // authored an Arabic name - rendering '' would leave a blank row.
      const blank = prize({ _id: 'pb', name: 'Latest Smartphone', nameI18n: { ar: '   ' } });
      const [row] = getBallotPrizeRows(cycle({ prizes: [blank] }), 'ar');
      expect(row?.name).toBe('Latest Smartphone');
    });

    it('still drops a prize whose default name is blank, whatever the locale', () => {
      // The existing rule: a nameless entry is a blank row in the modal. A
      // translation must not resurrect one.
      const nameless = prize({ _id: 'pn', name: '  ', nameI18n: { fr: 'Quelque chose' } });
      expect(getBallotPrizeRows(cycle({ prizes: [nameless] }), 'en')).toEqual([]);
    });
  });
  it('agrees with the card about which prize won', () => {
    // Both read the same cycle, so the row badged CHOSEN must be the prize the
    // tier card names. A divergence here is the exact bug being fixed.
    const c = cycle({ prizes: BALLOT, winner: winner('p4', '1 an de salle') });
    const elected = getBallotPrizeRows(c, EN).find(r => r.isElected);
    const card = getGrandPrizePresentation(c, EN);
    expect(elected?.name).toBe(card.name);
    expect(elected?.icon).toBe(card.icon);
  });
});
