import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components';
import { GuestUploadScreen } from '@/features/guest';
import { WalletProvider, useAuth, useTheme } from '@/app/providers';
import { AppNavigator } from './AppNavigator.tsx';
import { AuthNavigator } from './AuthNavigator.tsx';

/**
 * `restoring` keeps this on a spinner until the stored session has been
 * read (or found absent). Rendering AuthNavigator first would flash the login
 * screen at an already-signed-in user for one frame on every cold start.
 */
export function RootNavigator() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isAuthenticated, isGuest, pendingGuestUpload, restoring, otherAccountNotice, dismissOtherAccountNotice, logout } =
    useAuth();

  if (restoring) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
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
      <ConfirmDialog
        visible={isAuthenticated && otherAccountNotice !== null}
        variant="info"
        title={t('auth.otherAccountDataTitle')}
        message={t('auth.otherAccountDataMessage', { accounts: otherAccountNotice?.join(', ') ?? '' })}
        confirmLabel={t('auth.otherAccountDataContinue')}
        cancelLabel={t('settings.logout')}
        onConfirm={dismissOtherAccountNotice}
        onCancel={() => void logout()}
      />
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
 *
 * `fontWeight` is pinned to `'normal'` on every entry rather than named per
 * weight: Mulish ships one static file per weight, and Android resolves a
 * custom `fontFamily` + a non-`'normal'` `fontWeight` by looking for a bold
 * variant of that exact family name — finds none, and silently substitutes
 * the system font instead. The weight already lives in which file is named.
 */
const fonts = {
  regular: { fontFamily: 'Mulish_400Regular', fontWeight: 'normal' as const },
  medium: { fontFamily: 'Mulish_500Medium', fontWeight: 'normal' as const },
  bold: { fontFamily: 'Mulish_600SemiBold', fontWeight: 'normal' as const },
  heavy: { fontFamily: 'Mulish_700Bold', fontWeight: 'normal' as const },
};
