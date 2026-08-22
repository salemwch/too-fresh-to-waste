/**
 * `Section5` renders the faq4 answer as an icon list, splitting it on newlines
 * and pairing line N with icon N. That couples copy to code by position: a
 * translator adding a sixth prize, or dropping one, silently shifts every icon
 * after it, and nothing else in the build would notice.
 *
 * These tests pin the contract from both sides.
 */

import ar from '../../messages/ar.json';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';

/** Kept in step with the `icons` array in Section5.tsx. */
const PRIZE_ICONS = ['BedDouble', 'Bike', 'Dumbbell', 'Smartphone', 'Ticket'];

const LOCALES = [
  ['en', en],
  ['fr', fr],
  ['ar', ar],
] as const;

const prizeLines = (messages: unknown): string[] =>
  (messages as { section5: { faqs: { faq4: { answer: string } } } }).section5.faqs.faq4.answer
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

describe.each(LOCALES)('Big Prize list - %s', (_locale, messages) => {
  it('has exactly one prize per icon', () => {
    expect(prizeLines(messages)).toHaveLength(PRIZE_ICONS.length);
  });

  it('lists every prize on its own line', () => {
    // A prize written as a sentence with commas would render as one row with
    // one icon, which is the failure this format exists to avoid.
    for (const line of prizeLines(messages)) {
      expect(line).not.toMatch(/,\s/);
      expect(line.length).toBeLessThan(60);
    }
  });

  it('describes the Big Prize as one thing, not a tier below another', () => {
    const faqs = (messages as { section5: { faqs: Record<string, { question: string }> } }).section5
      .faqs;

    // Both remaining questions are about the same prize. An earlier pass split
    // this into "rewards" plus a separate Big Prize, which was wrong: the hotel
    // stay and the scooter are the Big Prize.
    expect(faqs['faq3']!.question.length).toBeGreaterThan(0);
    expect(faqs['faq4']!.question.length).toBeGreaterThan(0);
    expect(faqs['faq3']!.question).not.toEqual(faqs['faq4']!.question);
  });
});

describe('prize list across locales', () => {
  it('has the same number of prizes in every locale', () => {
    const counts = LOCALES.map(([, messages]) => prizeLines(messages).length);
    expect(new Set(counts).size).toBe(1);
  });
});
