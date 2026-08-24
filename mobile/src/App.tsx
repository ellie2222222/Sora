import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './app/i18n/index.ts';
import { AuthProvider } from './app/providers/AuthProvider.tsx';
import { LocaleProvider } from './app/providers/LocaleProvider.tsx';
import { QueryProvider } from './app/providers/QueryProvider.tsx';
import { ThemeProvider } from './app/providers/ThemeProvider.tsx';
import { RootNavigator } from './app/navigation/RootNavigator.tsx';

/**
 * Provider order matters:
 * - QueryProvider before AuthProvider, because AuthProvider's logout clears
 *   the query cache on sign-out — it needs a client to already exist above it.
 * - AuthProvider before ThemeProvider/LocaleProvider, because both hydrate
 *   their choice from the signed-in user's server-stored `theme`/`locale`
 *   exactly once — they need `useAuth()`'s user to be available to read from.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <QueryProvider>
        <AuthProvider>
          <ThemeProvider>
            <LocaleProvider>
              <StatusBar style="auto" />
              <RootNavigator />
            </LocaleProvider>
          </ThemeProvider>
        </AuthProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
