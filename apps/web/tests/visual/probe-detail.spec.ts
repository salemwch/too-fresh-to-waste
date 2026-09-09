import { test, expect, settle, localePath } from './fixtures';

/** Targeted follow-up probe for specific findings. Audit-only; never gates. */
test.describe('@audit detail', () => {
  test('companies unlabelled inputs', async ({ visualPage, locale }) => {
    await visualPage.goto(localePath(locale, '/companies'), { waitUntil: 'domcontentloaded' });
    await settle(visualPage);
    const info = await visualPage.evaluate(() =>
      Array.from(document.querySelectorAll('input:not([type=hidden]), select, textarea')).map(el => {
        const id = el.getAttribute('id');
        const labelled = id
          ? !!document.querySelector(`label[for="${CSS.escape(id)}"]`)
          : false;
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type'),
          id,
          name: el.getAttribute('name'),
          placeholder: el.getAttribute('placeholder'),
          ariaLabel: el.getAttribute('aria-label'),
          labelFor: labelled,
          inLabel: !!el.closest('label'),
          size: `${Math.round(r.width)}x${Math.round(r.height)}`,
        };
      }),
    );
     
    console.log('COMPANIES_INPUTS ' + JSON.stringify(info, null, 1));
    expect(info.length).toBeGreaterThan(0);
  });

  test('small interactive elements on home', async ({ visualPage, locale }) => {
    await visualPage.goto(localePath(locale, '/'), { waitUntil: 'domcontentloaded' });
    await settle(visualPage);
    const small = await visualPage.evaluate(() =>
      Array.from(document.querySelectorAll('a[href],button'))
        .map(el => {
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            text: (el.textContent ?? '').trim().slice(0, 28),
            w: Math.round(r.width),
            h: Math.round(r.height),
            inline: !!el.closest('p, li, span'),
          };
        })
        .filter(e => e.w > 0 && (e.h < 44 || e.w < 44))
        .filter(e => !e.inline) // WCAG 2.5.8 exempts inline links in text
        .slice(0, 20),
    );
     
    console.log('HOME_SMALL_TARGETS ' + JSON.stringify(small, null, 1));
    expect(Array.isArray(small)).toBe(true);
  });
});
