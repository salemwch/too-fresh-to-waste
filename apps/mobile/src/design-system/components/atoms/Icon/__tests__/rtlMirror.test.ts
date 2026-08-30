import { mirrorIconName, isDirectionalIcon } from '../rtlMirror';

describe('mirrorIconName', () => {
  describe('LTR never changes anything', () => {
    it.each([
      'chevron-back',
      'chevron-forward',
      'arrow-back',
      'arrow-forward',
      'heart',
      'play-back',
      'chevron-up',
    ])('leaves %s untouched', name => {
      expect(mirrorIconName(name, false)).toBe(name);
    });
  });

  describe('RTL flips icons that express reading direction', () => {
    it.each([
      ['chevron-back', 'chevron-forward'],
      ['chevron-forward', 'chevron-back'],
      ['chevron-back-outline', 'chevron-forward-outline'],
      ['arrow-back', 'arrow-forward'],
      ['arrow-forward', 'arrow-back'],
      ['arrow-back-circle', 'arrow-forward-circle'],
      ['caret-back', 'caret-forward'],
    ])('%s becomes %s', (input, expected) => {
      expect(mirrorIconName(input, true)).toBe(expected);
    });
  });

  describe('RTL leaves everything else alone', () => {
    // Mirroring these would be a bug, not an omission. Media transport follows
    // the timeline rather than the reading direction, and RTL never flips the
    // vertical axis.
    it.each([
      'play-back',
      'play-forward',
      'play-skip-back',
      'chevron-up',
      'chevron-down',
      'arrow-up',
      'arrow-down',
      'heart',
      'home',
      'search',
      'location',
    ])('does not mirror %s', name => {
      expect(mirrorIconName(name, true)).toBe(name);
      expect(isDirectionalIcon(name)).toBe(false);
    });

    it('passes an unknown icon name through rather than throwing', () => {
      expect(mirrorIconName('not-a-real-icon', true)).toBe('not-a-real-icon');
    });
  });

  describe('the map is symmetric', () => {
    // A half-registered pair would mirror one way and not back, which is the
    // most likely way for this table to rot as icons are added.
    const directional = [
      'chevron-back',
      'chevron-forward',
      'chevron-back-outline',
      'chevron-forward-outline',
      'chevron-back-circle',
      'chevron-forward-circle',
      'chevron-back-circle-outline',
      'chevron-forward-circle-outline',
      'arrow-back',
      'arrow-forward',
      'arrow-back-outline',
      'arrow-forward-outline',
      'arrow-back-circle',
      'arrow-forward-circle',
      'arrow-back-circle-outline',
      'arrow-forward-circle-outline',
      'caret-back',
      'caret-forward',
      'caret-back-outline',
      'caret-forward-outline',
      'caret-back-circle',
      'caret-forward-circle',
      'caret-back-circle-outline',
      'caret-forward-circle-outline',
    ];

    it('registers every name in both directions', () => {
      expect(directional.length).toBeGreaterThan(0);
      for (const name of directional) {
        expect(isDirectionalIcon(name)).toBe(true);
      }
    });

    it('is an involution - mirroring twice returns the original', () => {
      for (const name of directional) {
        expect(mirrorIconName(mirrorIconName(name, true), true)).toBe(name);
      }
    });

    it('never maps a name to itself', () => {
      for (const name of directional) {
        expect(mirrorIconName(name, true)).not.toBe(name);
      }
    });
  });
});
