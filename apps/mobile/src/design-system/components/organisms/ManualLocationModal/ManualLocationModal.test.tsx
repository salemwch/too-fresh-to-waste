import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import { ThemeProvider } from '@/design-system/providers';

import { ManualLocationModal } from './ManualLocationModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const TUNIS_RESULT = {
  displayName: 'Tunis, Tunisia',
  coordinates: { latitude: 36.8065, longitude: 10.1815 },
  address: { city: 'Tunis', country: 'Tunisia' },
};

const mockUseLocationSearch = jest.fn().mockReturnValue({
  data: undefined,
  isLoading: false,
  error: null,
});

jest.mock('@/features/offers/hooks', () => ({
  useLocationSearch: (...args: unknown[]) => mockUseLocationSearch(...args),
  // Re-export the type so the import doesn't break
}));

jest.mock('@shopify/flash-list', () => {
  const { FlatList } = require('react-native');
  return {
    FlashList: (props: Record<string, unknown>) => {
      const { estimatedItemSize: _e, ...rest } = props;
      return <FlatList {...rest} />;
    },
  };
});

describe('ManualLocationModal', () => {
  const onClose = jest.fn();
  const onLocationSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocationSearch.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
  });

  const setup = (visible = true) =>
    render(
      <ThemeProvider>
        <ManualLocationModal
          visible={visible}
          onClose={onClose}
          onLocationSelect={onLocationSelect}
          testID='city-search-modal'
        />
      </ThemeProvider>,
    );

  it('renders the search prompt when no query is entered', () => {
    const { getByText } = setup();
    expect(getByText('location.searchPrompt')).toBeTruthy();
  });

  it('shows the no-results message for a query with no matches', async () => {
    mockUseLocationSearch.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    const { getByText, getByDisplayValue } = setup();

    fireEvent.changeText(getByDisplayValue(''), 'Nonexistent');

    await waitFor(() => {
      expect(getByText('location.noLocationsFor')).toBeTruthy();
    });
  });

  it('selects a city, dismisses the keyboard, and closes the modal', async () => {
    const dismissSpy = jest.spyOn(Keyboard, 'dismiss');

    mockUseLocationSearch.mockReturnValue({
      data: [TUNIS_RESULT],
      isLoading: false,
      error: null,
    });

    const { getByText } = setup();

    fireEvent.press(getByText('Tunis'));

    expect(dismissSpy).toHaveBeenCalled();
    expect(onLocationSelect).toHaveBeenCalledWith({
      coordinates: { latitude: 36.8065, longitude: 10.1815 },
      name: 'Tunis, Tunisia',
    });
    expect(onClose).toHaveBeenCalled();

    dismissSpy.mockRestore();
  });

  it('closes the modal when cancel is pressed', () => {
    const { getByText } = setup();

    fireEvent.press(getByText('common.cancel'));

    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when not visible', () => {
    const { queryByTestId } = setup(false);
    expect(queryByTestId('city-search-modal')).toBeNull();
  });
});
