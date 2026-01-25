import React, { StrictMode } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { OfflineBanner } from '@/components/Errors';
import { ThemeProvider } from '@/design-system/providers';
import { QueryProvider } from '@/lib/react-query';
import { RootNavigator } from '@/navigation';
import { store, persistor } from '@/store';
import { toastConfig } from '@/utils/toast';

/**
 * Main App Component
 * Wraps the entire app with necessary providers
 *
 * Provider Hierarchy:
 * 1. GestureHandlerRootView - Gesture handling
 * 2. SafeAreaProvider - Safe area insets
 * 3. ReduxProvider - Global state management
 * 4. PersistGate - Redux persistence
 * 5. QueryProvider - TanStack Query (data fetching, caching)
 * 6. ThemeProvider - Design system theming
 * 7. RootNavigator - Navigation
 */
function App(): React.JSX.Element {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ReduxProvider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <QueryProvider>
              <ThemeProvider defaultTheme={isDarkMode ? 'dark' : 'light'}>
                <OfflineBanner />
                <StatusBar
                  barStyle={isDarkMode ? 'light-content' : 'dark-content'}
                  backgroundColor='transparent'
                  translucent
                />
                <StrictMode>
                  <RootNavigator />
                </StrictMode>
                {/* Toast must be last in the component tree to render on top */}
                <Toast config={toastConfig} />
              </ThemeProvider>
            </QueryProvider>
          </PersistGate>
        </ReduxProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
