import { useCallback, useEffect } from 'react';

import '../global.css';

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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '@/app/i18n';
import '@/services/guest';
import { AuthProvider, LocaleProvider, ThemeProvider, ToastProvider } from '@/app/providers';
import { NetworkStatusProvider } from '@/hooks';
import { RootNavigator } from '@/app/navigation';
import { ErrorBoundary } from '@/components';
import { store } from '@/app/store';
import { requestSyncNow, startSyncEngine } from '@/services/sync';

startSyncEngine(store);

void SplashScreen.preventAutoHideAsync();

/**
 * Provider order matters: AuthProvider before ThemeProvider/LocaleProvider, because both
 * hydrate their choice from the signed-in user's server-stored `theme`/`locale` exactly
 * once — they need `useAuth()`'s user to be available to read from.
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ReduxProvider store={store}>
        <SafeAreaProvider>
          <NetworkStatusProvider onRetrySync={() => requestSyncNow(store)}>
            <AuthProvider>
              <ThemeProvider>
                <LocaleProvider>
                  <ToastProvider>
                    <StatusBar style="auto" />
                    <ErrorBoundary>
                      <RootNavigator />
                    </ErrorBoundary>
                  </ToastProvider>
                </LocaleProvider>
              </ThemeProvider>
            </AuthProvider>
          </NetworkStatusProvider>
        </SafeAreaProvider>
      </ReduxProvider>
    </GestureHandlerRootView>
  );
}
