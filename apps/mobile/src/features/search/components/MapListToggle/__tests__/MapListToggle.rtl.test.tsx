/**
 * MapListToggle — RTL regression
 *
 * The selection pill is anchored with `insetInlineStart`, which the layout
 * engine resolves to the RIGHT edge under RTL. Its position is then animated
 * with `translateX`, and RN never mirrors transforms — so a positive offset
 * that slides the pill inward in English slides it off-screen in Arabic.
 *
 * These tests lock the anchor and the sign of the transform together, because
 * either one alone is what makes the component correct.
 */

import { render } from '@testing-library/react-native';
import React from 'react';
import { I18nManager } from 'react-native';

jest.mock('@/design-system/components/atoms', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Text: ({ children }: { children?: unknown }) =>
      mockReact.createElement(mockRN.Text, null, children as React.ReactNode),
    Icon: () => null,
  };
});

jest.mock('@/design-system/providers', () => ({
  useTheme: () => ({
    colors: {
      surfaceVariant: '#eee',
      background: '#fff',
      primary: '#1E4448',
      onSurfaceVariant: '#666',
    },
  }),
}));

import { MapListToggle } from '../MapListToggle';

/** Reads the resolved translateX off the animated indicator (the first View). */
function indicatorTranslateX(tree: ReturnType<typeof render>): number {
  const json = tree.toJSON();
  const root = Array.isArray(json) ? json[0] : json;
  const indicator = root?.children?.[0] as { props?: { style?: unknown } } | undefined;
  const styles = ([] as unknown[]).concat(indicator?.props?.style ?? []);
  for (const s of styles) {
    const transform = (s as { transform?: { translateX?: number }[] })?.transform;
    const x = transform?.[0]?.translateX;
    if (typeof x === 'number') return x;
  }
  throw new Error('no translateX found on the selection indicator');
}

describe('MapListToggle RTL', () => {
  const original = I18nManager.isRTL;

  // No jest.resetModules() here: `isRTL` is read inside the useMemo factory at
  // render time, so a fresh render is enough to pick up the flag. Resetting
  // modules would also tear down the i18next instance jest.setup.js installs.
  afterEach(() => {
    (I18nManager as { isRTL: boolean }).isRTL = original;
  });

  it('anchors the indicator with a logical inset, never a physical one', () => {
    const tree = render(<MapListToggle value='map' onChange={jest.fn()} />);
    const json = tree.toJSON();
    const root = Array.isArray(json) ? json[0] : json;
    const indicator = root?.children?.[0] as { props?: { style?: unknown } } | undefined;
    const flat = Object.assign({}, ...([] as object[]).concat(indicator?.props?.style ?? []));

    expect(flat).toHaveProperty('insetInlineStart');
    expect(flat).not.toHaveProperty('left');
    expect(flat).not.toHaveProperty('right');
  });

  it('slides the indicator inward (positive X) in LTR', () => {
    (I18nManager as { isRTL: boolean }).isRTL = false;
    expect(indicatorTranslateX(render(<MapListToggle value='map' onChange={jest.fn()} />))).toBe(2);
  });

  it('slides the indicator inward (negative X) in RTL', () => {
    (I18nManager as { isRTL: boolean }).isRTL = true;
    expect(indicatorTranslateX(render(<MapListToggle value='map' onChange={jest.fn()} />))).toBe(
      -2,
    );
  });
});
