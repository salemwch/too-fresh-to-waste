import { fireEvent, render, screen } from '@testing-library/react';

import { InfoDisclosure } from '../info-disclosure';

/**
 * DESIGN.md §13.12. What is asserted is the contract a keyboard or screen-reader
 * user depends on - not the visual.
 */
describe('InfoDisclosure', () => {
  const renderIt = () =>
    render(
      <InfoDisclosure label={<span>Pending</span>} buttonLabel='What is Pending?'>
        Paid online, not collected yet.
      </InfoDisclosure>,
    );

  it('starts closed, with the explanation hidden', () => {
    renderIt();

    const button = screen.getByRole('button', { name: 'What is Pending?' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('Paid online, not collected yet.').hidden).toBe(true);
  });

  it('opens on press and points the button at the panel it controls', () => {
    renderIt();

    const button = screen.getByRole('button', { name: 'What is Pending?' });
    fireEvent.click(button);

    const panel = screen.getByText('Paid online, not collected yet.');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
    expect(button.getAttribute('aria-controls')).toBe(panel.id);
  });

  it('closes again on a second press', () => {
    renderIt();

    const button = screen.getByRole('button', { name: 'What is Pending?' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('is a real button, so keyboard users reach it and it never submits a form', () => {
    renderIt();

    expect(screen.getByRole('button', { name: 'What is Pending?' }).getAttribute('type')).toBe(
      'button',
    );
  });
});
