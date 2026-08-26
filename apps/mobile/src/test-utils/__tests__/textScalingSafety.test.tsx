/**
 * D1 regression - text inside a flex row must be able to shrink.
 *
 * THE BUG THIS ENCODES
 * --------------------
 * At a 1.3x system font scale, LoginScreen rendered `Password` as `Passw`,
 * `Email Address` as `Email` and `OR` as `O`. The cause was not
 * `numberOfLines`: a flex child is `flexShrink: 0` by default in React Native,
 * so once the scaled glyphs no longer fit the row, the `<Text>` kept its
 * intrinsic width and the parent clipped it.
 *
 * WHY THIS SHAPE OF TEST
 * ----------------------
 * Jest does not run Yoga layout, so no unit test can observe the clipping
 * itself - that needed a device, and it took one. What a test *can* do is
 * assert the structural property whose absence caused it: a text node sitting
 * in a row must either shrink, be allowed to wrap, or be explicitly exempt.
 *
 * That is a weaker claim than "nothing is clipped", and it is stated as such.
 * It is not a substitute for the device check in
 * MOBILE_DEVICE_VERIFICATION_REPORT.md - it is the thing that catches the next
 * row someone adds without one.
 */

import React from 'react';

import { LoginScreen } from '@/features/auth/screens/LoginScreen';
import { renderCaseAsync } from '@/test-utils/visualMatrix';

/* Native auth SDK - it ships ESM and renders nothing meaningful under test.
 * Mocked rather than added to the shared transform allowlist: transforming a
 * native module for every suite costs time and buys nothing, whereas
 * react-native-progress genuinely renders (the password-strength bar) and is
 * allowlisted for that reason. */
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
  statusCodes: {},
  GoogleSigninButton: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), addListener: () => () => {} }),
  useFocusEffect: () => undefined,
  useRoute: () => ({ params: {} }),
}));

jest.mock('react-redux', () => {
  const useSelector = (selector: (s: unknown) => unknown) =>
    selector({ auth: { user: null, isAuthenticated: false, isLoading: false, error: null } });
  const useDispatch = () => jest.fn();
  useSelector.withTypes = () => useSelector;
  useDispatch.withTypes = () => useDispatch;
  return { useDispatch, useSelector };
});

interface Node {
  type?: unknown;
  props?: Record<string, unknown>;
  children?: unknown;
}

const flatten = (style: unknown): Record<string, unknown> => {
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
  if (style && typeof style === 'object') return style as Record<string, unknown>;
  return {};
};

/** Does this subtree render any text? */
const containsText = (node: unknown): boolean => {
  if (typeof node === 'string') return node.trim().length > 0;
  if (Array.isArray(node)) return node.some(containsText);
  if (!node || typeof node !== 'object') return false;
  const n = node as Node;
  if (n.type === 'Text') return true;
  return containsText(n.children);
};

/**
 * A row child is safe when it can give up width, when the row can break, or
 * when it is a fixed-size non-text element (an icon, a rule, a checkbox).
 */
const isSafe = (childStyle: Record<string, unknown>, rowStyle: Record<string, unknown>): boolean =>
  childStyle['flexShrink'] !== undefined ||
  childStyle['flex'] !== undefined ||
  rowStyle['flexWrap'] === 'wrap' ||
  // A child with an explicit width cannot be squeezed by its siblings - a
  // checkbox, an icon or an avatar keeps its box whatever the font does. The
  // glyph inside it is a different question, and not this row's problem.
  childStyle['width'] !== undefined;

const findUnsafeRows = (tree: unknown): string[] => {
  const problems: string[] = [];

  const visit = (node: unknown, path: string): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((c, i) => visit(c, `${path}[${i}]`));
      return;
    }
    const n = node as Node;
    const style = flatten(n.props?.['style']);

    if (style['flexDirection'] === 'row' && Array.isArray(n.children)) {
      const textChildren = n.children.filter(c => c && typeof c === 'object' && containsText(c));
      // Only rows holding more than one thing can squeeze their text.
      if (n.children.length > 1) {
        for (const [i, child] of textChildren.entries()) {
          const cs = flatten((child as Node).props?.['style']);
          if (!isSafe(cs, style))
            problems.push(
              `${path} > text child ${i} :: rowStyle=${JSON.stringify(style)} childStyle=${JSON.stringify(cs)} text=${JSON.stringify(String(JSON.stringify(child)).slice(0, 120))}`,
            );
        }
      }
    }

    visit(n.children, path);
  };

  visit(tree, 'root');
  return problems;
};

describe('text scaling safety (device finding D1)', () => {
  it('LoginScreen has no row that would clip its text when the font scales', async () => {
    const { result } = await renderCaseAsync(
      <LoginScreen {...({} as React.ComponentProps<typeof LoginScreen>)} />,
      {
        device: 'small',
        theme: 'light',
        locale: 'en',
      },
    );

    expect(findUnsafeRows(result.toJSON())).toEqual([]);
  });

  it('detects an unshrinkable text row, so the check cannot pass vacuously', () => {
    // The shape the fix removed: two children, neither able to give up width.
    const bad = {
      type: 'View',
      props: { style: { flexDirection: 'row' } },
      children: [
        { type: 'Text', props: {}, children: ['Password'] },
        { type: 'View', props: { style: { width: 28 } }, children: [] },
      ],
    };
    expect(findUnsafeRows(bad)).not.toEqual([]);

    const good = {
      ...bad,
      children: [
        { type: 'Text', props: { style: { flexShrink: 1 } }, children: ['Password'] },
        { type: 'View', props: { style: { width: 28 } }, children: [] },
      ],
    };
    expect(findUnsafeRows(good)).toEqual([]);
  });
});
