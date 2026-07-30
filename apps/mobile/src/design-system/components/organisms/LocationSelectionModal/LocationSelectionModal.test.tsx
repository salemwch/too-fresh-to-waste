import { fireEvent, render } from '@testing-library/react-native';

import { ThemeProvider } from '@/design-system/providers';

import { LocationSelectionModal } from './LocationSelectionModal';

/**
 * This modal used to carry an appearance gate and dismiss-timing plumbing,
 * added to fix "the app returns to the launcher when you tap 'Use current
 * location' immediately". That diagnosis was wrong. The app was crashing, not
 * being backgrounded: `locationSlice` issued two concurrent getCurrentPosition
 * calls and Play Services threw `NullPointerException: Listener must not be
 * null` on the second delivery. Proven from a release-70 logcat deobfuscated
 * through mapping.txt; the Modal was never part of it.
 *
 * So the behaviour these tests protect is deliberately plain: a press reaches
 * the caller straight away, and the only thing that suppresses it is a request
 * already being in flight. The first test exists to keep it that way — a
 * reintroduced gate would make the button briefly dead for no benefit.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../ManualLocationModal', () => ({
  ManualLocationModal: () => null,
}));

describe('LocationSelectionModal', () => {
  const setup = (props: Partial<React.ComponentProps<typeof LocationSelectionModal>> = {}) => {
    const onLocationSelect = jest.fn();
    const utils = render(
      <ThemeProvider>
        <LocationSelectionModal visible onLocationSelect={onLocationSelect} {...props} />
      </ThemeProvider>,
    );
    return {
      ...utils,
      onLocationSelect,
      gpsOption: utils.getByTestId('location-selection-modal-gps-option'),
      cityOption: utils.getByTestId('location-selection-modal-city-option'),
    };
  };

  it('reports a GPS selection on the very first press, with no appearance gate', () => {
    const { gpsOption, onLocationSelect } = setup();

    fireEvent.press(gpsOption);

    // Nothing is emitted between render and press — no onShow, no timers. If
    // this ever needs a warm-up signal again, the reason must be a reproduced
    // failure, not a theory.
    expect(onLocationSelect).toHaveBeenCalledWith({ latitude: 0, longitude: 0 }, 'gps');
  });

  it('uses the (0, 0) + "gps" sentinel the caller branches on', () => {
    const { gpsOption, onLocationSelect } = setup();

    fireEvent.press(gpsOption);

    // useLocationSetup distinguishes the GPS request from a real coordinate
    // selection by this exact shape. Changing it silently routes GPS presses
    // into the manual-location branch.
    expect(onLocationSelect).toHaveBeenCalledTimes(1);
    expect(onLocationSelect.mock.calls[0]).toEqual([{ latitude: 0, longitude: 0 }, 'gps']);
  });

  it('stays inert while a location request is already running', () => {
    const { gpsOption, onLocationSelect } = setup({ isLoading: true });

    fireEvent.press(gpsOption);

    expect(onLocationSelect).not.toHaveBeenCalled();
  });

  it('does not emit a selection when the city option is pressed', () => {
    const { cityOption, onLocationSelect } = setup();

    fireEvent.press(cityOption);

    // The city option opens the search modal; the selection arrives later, from
    // ManualLocationModal. Emitting here would set a location the user has not
    // chosen yet.
    expect(onLocationSelect).not.toHaveBeenCalled();
  });

  it('shows a provided error without blocking a retry', () => {
    const { getByText, gpsOption, onLocationSelect } = setup({
      error: 'Failed to get your location. Please try another option.',
    });

    expect(getByText('Failed to get your location. Please try another option.')).toBeTruthy();

    // The GPS failure path reopens this modal with an error. The user has to be
    // able to tap again immediately.
    fireEvent.press(gpsOption);
    expect(onLocationSelect).toHaveBeenCalledTimes(1);
  });
});
