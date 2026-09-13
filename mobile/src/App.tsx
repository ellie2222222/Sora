import '../global.css';
import { useCallback, useEffect } from 'react';

import {
  Mulish_400Regular,
  Mulish_500Medium,
  Mulish_600SemiBold,
  Mulish_700Bold,
  useFonts,
} from '@expo-google-fonts/mulish';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Provider as ReduxProvider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './app/i18n/index.ts';
import './services/guest/guestRuntime.ts';
import { AuthProvider } from './app/providers/AuthProvider.tsx';
import { LocaleProvider } from './app/providers/LocaleProvider.tsx';
import { QueryProvider } from './app/providers/QueryProvider.tsx';
import { ThemeProvider } from './app/providers/ThemeProvider.tsx';
import { NetworkStatusProvider } from './hooks/useNetworkStatus.ts';
import { RootNavigator } from './app/navigation/RootNavigator.tsx';
import { store } from './app/store/index.ts';

void SplashScreen.preventAutoHideAsync();

/**
 * Provider order matters:
 * - QueryProvider before AuthProvider, because AuthProvider's logout clears
 *   the query cache on sign-out — it needs a client to already exist above it.
 * - AuthProvider before ThemeProvider/LocaleProvider, because both hydrate
 *   their choice from the signed-in user's server-stored `theme`/`locale`
 *   exactly once — they need `useAuth()`'s user to be available to read from.
 *
 * The splash screen stays up until Mulish is loaded — every `Text` renders
 * through `design-system/typography.ts`'s `fontFamily` tokens, so rendering
 * one frame before the fonts land would flash the platform default font.
 */
export default function App() {
  const [fontsLoaded] = useFonts({
    Mulish_400Regular,
    Mulish_500Medium,
    Mulish_600SemiBold,
    Mulish_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    void onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsLoaded) return null;

  return (
    <ReduxProvider store={store}>
      <SafeAreaProvider>
        <QueryProvider>
          <NetworkStatusProvider>
            <AuthProvider>
              <ThemeProvider>
                <LocaleProvider>
                  <StatusBar style="auto" />
                  <RootNavigator />
                </LocaleProvider>
              </ThemeProvider>
            </AuthProvider>
          </NetworkStatusProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </ReduxProvider>
  );
}
