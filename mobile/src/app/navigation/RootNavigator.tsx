import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, Platform, View } from 'react-native';

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
 * and tab-bar chrome; this app's design-system tokens govern every screen's own
 * text, so only the platform system font needs to be named here.
 */
const navigationFonts = Platform.select({
  ios: { fontFamily: 'System' },
  android: { fontFamily: 'sans-serif' },
  default: { fontFamily: 'System' },
});

const fonts = {
  regular: { ...navigationFonts, fontWeight: '400' as const },
  medium: { ...navigationFonts, fontWeight: '500' as const },
  bold: { ...navigationFonts, fontWeight: '600' as const },
  heavy: { ...navigationFonts, fontWeight: '700' as const },
};
