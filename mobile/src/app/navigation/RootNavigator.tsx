import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';

import { GuestUploadScreen } from '../../features/guest/screens/GuestUploadScreen.tsx';
import { useAuth } from '../providers/AuthProvider.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { WalletProvider } from '../providers/WalletProvider.tsx';
import { AppNavigator } from './AppNavigator.tsx';
import { AuthNavigator } from './AuthNavigator.tsx';

/**
 * `restoring` keeps this on a blank screen until the stored session has been
 * read (or found absent). Rendering AuthNavigator first would flash the login
 * screen at an already-signed-in user for one frame on every cold start.
 */
export function RootNavigator() {
  const theme = useTheme();
  const { isAuthenticated, isGuest, pendingGuestUpload, restoring } = useAuth();

  if (restoring) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{ dark: theme.mode === 'dark', colors: navigationColors(theme), fonts }}
    >
      {pendingGuestUpload ? (
        <GuestUploadScreen />
      ) : isAuthenticated || isGuest ? (
        <WalletProvider>
          <AppNavigator />
        </WalletProvider>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

function navigationColors(theme: ReturnType<typeof useTheme>) {
  return {
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    notification: theme.colors.danger,
  };
}

/**
 * react-navigation v7's Theme type requires a `fonts` block for its own header
 * and tab-bar chrome. Named per-weight, matching `design-system/typography.ts`'s
 * `fontFamily` tokens that every other screen's own text already uses.
 */
const fonts = {
  regular: { fontFamily: 'Mulish_400Regular', fontWeight: '400' as const },
  medium: { fontFamily: 'Mulish_500Medium', fontWeight: '500' as const },
  bold: { fontFamily: 'Mulish_600SemiBold', fontWeight: '600' as const },
  heavy: { fontFamily: 'Mulish_700Bold', fontWeight: '700' as const },
};
