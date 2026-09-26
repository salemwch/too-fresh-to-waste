/**
 * The two sheets that send money-bearing input to the backend.
 *
 * ConfirmCashSheet decides the `collectedCash` recorded against the driver;
 * ReportProblemSheet decides `deliveryFailure`. Each case is a real way a
 * driver can fill them in, asserted on what reaches `onConfirm` / `onSubmit` -
 * the value that becomes a ledger row.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ThemeProvider } from '@/design-system/providers';
import en from '@/i18n/locales/en.json';

/** English copy, so a missing key fails here instead of rendering its path. */
const d = en.driver;

import { ConfirmCashSheet } from '../ConfirmCashSheet';
import { ReportProblemSheet } from '../ReportProblemSheet';

describe('ConfirmCashSheet', () => {
  const renderSheet = (over: Partial<React.ComponentProps<typeof ConfirmCashSheet>> = {}) => {
    const onConfirm = jest.fn();
    render(
      <ThemeProvider>
        <ConfirmCashSheet
          visible
          expected={14}
          paidOnline={false}
          isSubmitting={false}
          onClose={jest.fn()}
          onConfirm={onConfirm}
          {...over}
        />
      </ThemeProvider>,
    );
    return { onConfirm };
  };

  const input = () => screen.getByDisplayValue(/\d/);
  const confirm = () => screen.getByText(d.confirmDelivery);

  it('starts at the frozen expected amount and confirms it as a number', () => {
    const { onConfirm } = renderSheet();

    expect(input().props['value']).toBe('14.000');
    fireEvent.press(confirm());

    expect(onConfirm).toHaveBeenCalledWith(14);
  });

  it('reads a French comma amount', () => {
    const { onConfirm } = renderSheet();

    fireEvent.changeText(input(), '14,000');
    fireEvent.press(confirm());

    expect(onConfirm).toHaveBeenCalledWith(14);
  });

  it('allows a short collection but says it will be reviewed', () => {
    const { onConfirm } = renderSheet();

    fireEvent.changeText(input(), '12');

    expect(screen.getByText(/less than expected/)).toBeTruthy();
    fireEvent.press(confirm());
    expect(onConfirm).toHaveBeenCalledWith(12);
  });

  it('blocks more than the customer owes - the change goes back, not into the ledger', () => {
    const { onConfirm } = renderSheet();

    fireEvent.changeText(input(), '20');
    fireEvent.press(confirm());

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/more than the customer owes/)).toBeTruthy();
  });

  it.each(['', 'abc', '14.5.1'])('blocks an unreadable amount %p', text => {
    const { onConfirm } = renderSheet();

    fireEvent.changeText(input(), text);
    fireEvent.press(confirm());

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('collects nothing on an online-paid order and confirms 0', () => {
    const { onConfirm } = renderSheet({ paidOnline: true, expected: 0 });

    expect(screen.getByText(d.confirmOnlineBody)).toBeTruthy();
    fireEvent.press(confirm());

    expect(onConfirm).toHaveBeenCalledWith(0);
  });
});

describe('ReportProblemSheet', () => {
  const renderSheet = () => {
    const onSubmit = jest.fn();
    render(
      <ThemeProvider>
        <ReportProblemSheet visible isSubmitting={false} onClose={jest.fn()} onSubmit={onSubmit} />
      </ThemeProvider>,
    );
    return { onSubmit };
  };
  const send = () => screen.getByText(d.sendReport);

  it('sends nothing until a reason is chosen', () => {
    const { onSubmit } = renderSheet();

    fireEvent.press(send());

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('defaults a customer-fault failure to "not decided yet" - no loss booked', () => {
    const { onSubmit } = renderSheet();

    fireEvent.press(screen.getByText(d.reasonCUSTOMER_REFUSED));
    fireEvent.press(send());

    expect(onSubmit).toHaveBeenCalledWith({
      reason: 'CUSTOMER_REFUSED',
      recovery: 'RECOVERABLE_PENDING',
    });
  });

  it('records the chosen outcome and trimmed notes', () => {
    const { onSubmit } = renderSheet();

    fireEvent.press(screen.getByText(d.reasonDRIVER_FAULT));
    fireEvent.press(screen.getByText(d.recoveryUNRECOVERABLE));
    // The Input atom labels its wrapper and its field; type into the field.
    const notesField = screen
      .getAllByLabelText(d.problemNotesLabel)
      .find(el => typeof el.props['onChangeText'] === 'function');
    if (!notesField) throw new Error('notes field not found');
    fireEvent.changeText(notesField, '  flat tyre  ');
    fireEvent.press(send());

    expect(onSubmit).toHaveBeenCalledWith({
      reason: 'DRIVER_FAULT',
      recovery: 'UNRECOVERABLE',
      notes: 'flat tyre',
    });
  });

  it('offers a merchant-fault failure only the outcome the backend accepts', () => {
    const { onSubmit } = renderSheet();

    fireEvent.press(screen.getByText(d.reasonCUSTOMER_REFUSED));
    fireEvent.press(screen.getByText(d.recoveryUNRECOVERABLE));
    fireEvent.press(screen.getByText(d.reasonMERCHANT_FAULT));

    expect(screen.queryByText(d.recoveryUNRECOVERABLE)).toBeNull();
    fireEvent.press(send());
    expect(onSubmit).toHaveBeenCalledWith({
      reason: 'MERCHANT_FAULT',
      recovery: 'RETURNED_TO_MERCHANT',
    });
  });
});
