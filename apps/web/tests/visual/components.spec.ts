import { test, expect, settle, localePath } from './fixtures';

/**
 * Shared primitives, screenshotted section by section rather than as one long
 * page.
 *
 * Per-section shots keep a diff readable: when Button changes, the Button
 * baseline fails and nothing else does. A single full-page baseline would go
 * red for any change anywhere and tell you nothing about where.
 */

const SECTIONS = [
  'button',
  'form',
  'card',
  'badge',
  'alert',
  'separator',
  'select',
  'tabs',
] as const;

test.describe('shared components', () => {
  test.beforeEach(async ({ visualPage, locale }) => {
    await visualPage.goto(localePath(locale, '/visual-harness'));
    await settle(visualPage);
  });

  for (const section of SECTIONS) {
    test(`${section}`, async ({ visualPage }) => {
      const target = visualPage.locator(`[data-visual="${section}"]`);
      await expect(target).toBeVisible();
      await expect(target).toHaveScreenshot(`${section}.png`);
    });
  }

  test('select, open menu with a selection', async ({ visualPage }) => {
    // The check indicator only renders for a selected item, and its offset is
    // paired with the item's inline padding on a different element - a pair
    // that can only go wrong in RTL.
    await visualPage.locator('#vh-select-selected').click();
    await expect(visualPage.getByRole('listbox')).toBeVisible();
    await expect(visualPage).toHaveScreenshot('select-open-selected.png');
  });

  test('select, open menu', async ({ visualPage }) => {
    await visualPage.locator('[data-visual-select]').click();
    // The menu is portalled to the body, so screenshot the viewport, not the
    // section - the content is not inside [data-visual="select"].
    const menu = visualPage.getByRole('listbox');
    await expect(menu).toBeVisible();
    await expect(visualPage).toHaveScreenshot('select-open.png');
  });

  test('dialog, open', async ({ visualPage }) => {
    await visualPage.locator('[data-visual-dialog-trigger]').click();
    const dialog = visualPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(visualPage).toHaveScreenshot('dialog-open.png');
  });

  test('button, focus ring', async ({ visualPage }) => {
    // Focus rings are the thing V8 fixed and the thing most likely to regress
    // silently, because nothing else renders differently.
    const button = visualPage.locator('[data-visual="button"] button').first();
    await button.focus();
    await expect(visualPage.locator('[data-visual="button"]')).toHaveScreenshot('button-focus.png');
  });

  test('input, focus ring', async ({ visualPage }) => {
    await visualPage.locator('#vh-input').focus();
    await expect(visualPage.locator('[data-visual="form"]')).toHaveScreenshot('input-focus.png');
  });
});
