import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useMemo } from 'react';
import { ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog, ThemedView } from '@/components';
import { INVITATION_LINK_PATH } from '@/features/auth';
import { GuestUploadIndicator, GuestUploadScreen } from '@/features/guest';
import { WalletSwitchOverlay } from '@/features/wallets';
import { WalletProvider, useAuth, useTheme } from '@/app/providers';
import { useConnectivityToasts } from '@/hooks';
import { AppNavigator } from './AppNavigator.tsx';
import { AuthNavigator } from './AuthNavigator.tsx';
import type { AppStackParamList, AuthStackParamList } from './types.ts';

/**
 * Both stacks name the invitation screen AcceptInvitation, so one path resolves in whichever is
 * mounted; `?token=` becomes its route param. A link opened cold is otherwise the stack's only
 * route, so back would leave the app: `initialRouteName` puts that stack's start beneath it.
 */
function linkingFor(home: 'Main' | 'Login'): LinkingOptions<AppStackParamList & AuthStackParamList> {
  return {
    prefixes: [Linking.createURL('/', { scheme: 'sora' }), 'sora://', 'com.sora.app://'],
    config: { initialRouteName: home, screens: { AcceptInvitation: INVITATION_LINK_PATH } },
  };
}

/**
 * `restoring` keeps this on a spinner until the stored session has been
 * read (or found absent). Rendering AuthNavigator first would flash the login
 * screen at an already-signed-in user for one frame on every cold start.
 */
export function RootNavigator() {
  const theme = useTheme();
  const { t } = useTranslation();
  const {
    isAuthenticated,
    isGuest,
    pendingGuestUpload,
    guestUploadInBackground,
    restoring,
    otherAccountNotice,
    dismissOtherAccountNotice,
    logout,
  } = useAuth();
  useConnectivityToasts();
  const home = isAuthenticated || isGuest ? 'Main' : 'Login';
  const linking = useMemo(() => linkingFor(home), [home]);

  if (restoring) {
    return (
      <ThemedView className="flex-1 items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.primary} />
      </ThemedView>
    );
  }

  return (
    <NavigationContainer
      linking={linking}
      theme={{ dark: theme.mode === 'dark', colors: navigationColors(theme), fonts }}
    >
      {pendingGuestUpload ? (
        <GuestUploadScreen />
      ) : isAuthenticated || isGuest ? (
        <WalletProvider>
          <AppNavigator />
          <WalletSwitchOverlay />
        </WalletProvider>
      ) : (
        <AuthNavigator />
      )}
      <GuestUploadIndicator visible={guestUploadInBackground} />
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
