import { fireEvent, render, act } from '@testing-library/react-native';
import { Modal } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { ThemeProvider } from '@/design-system/providers';

import { LocationSelectionModal } from './LocationSelectionModal';

/**
 * Regression cover for the "app returns to the launcher when you tap
 * 'Use current location' immediately" bug.
 *
 * On Android this Modal is a real Dialog window with a fade-in. A press that
 * lands while that enter animation is still running queues the dialog's
 * dismiss behind it, so the window is still attached when the caller starts
 * the runtime-permission Activity — the two windows conflict and the task is
 * pushed to the background. Waiting a beat before tapping avoided it, which is
 * exactly the asymmetry users reported.
 *
 * The fix gates presses on the Dialog's own `onShow`. These tests drive that
 * gate directly rather than asserting on a timer, so they stay honest if the
 * fade duration ever changes.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../ManualLocationModal', () => ({
  ManualLocationModal: () => null,
}));

/** Fires the native Dialog's show event, which RN dispatches as `onShow`. */
function emitShow(modal: ReactTestInstance): void {
  act(() => {
    (modal.props['onShow'] as (() => void) | undefined)?.();
  });
}

describe('LocationSelectionModal', () => {
  const setup = (props: Partial<React.ComponentProps<typeof LocationSelectionModal>> = {}) => {
    const onLocationSelect = jest.fn();
    const utils = render(
      <ThemeProvider>
        <LocationSelectionModal visible onLocationSelect={onLocationSelect} {...props} />
      </ThemeProvider>,
    );
    const gpsOption = utils.getByTestId('location-selection-modal-gps-option');
    const modal = utils.UNSAFE_getByType(Modal);
    return { ...utils, onLocationSelect, gpsOption, modal };
  };

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('ignores a press that lands before the dialog window has appeared', () => {
    const { gpsOption, onLocationSelect } = setup();

    fireEvent.press(gpsOption);

    // This is the crash: the press must not reach the caller, because the
    // caller immediately closes the modal and starts the permission Activity.
    expect(onLocationSelect).not.toHaveBeenCalled();
  });

  it('accepts the press once the dialog reports it is shown', () => {
    const { gpsOption, modal, onLocationSelect } = setup();

    emitShow(modal);
    fireEvent.press(gpsOption);

    expect(onLocationSelect).toHaveBeenCalledWith({ latitude: 0, longitude: 0 }, 'gps');
  });

  it('unlocks on its own if onShow never arrives, rather than dead-ending', () => {
    const { gpsOption, onLocationSelect } = setup();

    act(() => {
      jest.advanceTimersByTime(1_200);
    });
    fireEvent.press(gpsOption);

    expect(onLocationSelect).toHaveBeenCalledTimes(1);
  });

  it('stays inert while a location request is already running', () => {
    const { gpsOption, modal, onLocationSelect } = setup({ isLoading: true });

    emitShow(modal);
    fireEvent.press(gpsOption);

    expect(onLocationSelect).not.toHaveBeenCalled();
  });

  it('re-arms the gate when the modal is shown again after an error', () => {
    // The GPS failure path reopens this modal. If `hasAppeared` stuck at true
    // from the first showing, the reopened dialog would be pressable during
    // its fade — the original bug, reachable on the retry.
    const onLocationSelect = jest.fn();
    const { rerender, getByTestId } = render(
      <ThemeProvider>
        <LocationSelectionModal visible onLocationSelect={onLocationSelect} />
      </ThemeProvider>,
    );

    rerender(
      <ThemeProvider>
        <LocationSelectionModal visible={false} onLocationSelect={onLocationSelect} />
      </ThemeProvider>,
    );
    rerender(
      <ThemeProvider>
        <LocationSelectionModal visible onLocationSelect={onLocationSelect} />
      </ThemeProvider>,
    );

    fireEvent.press(getByTestId('location-selection-modal-gps-option'));

    expect(onLocationSelect).not.toHaveBeenCalled();
  });
});
