import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';

import { LogIn } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { loginSchema, type LoginRequest } from '@sora/contracts';

import { AnimatedScreen, Button, GoogleLogo, Input, Text, ThemedView } from '@/components';
import { useAuth, useLocaleControl, useTheme } from '@/app/providers';
import { deviceTimeZone, messageOf, zodFormResolver } from '@/utils';
import { AuthPreferences } from '../components/AuthPreferences.tsx';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn.ts';
import type { AuthStackScreenProps } from '@/app/navigation';

export function LoginScreen({ navigation }: AuthStackScreenProps<'Login'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { login, loginWithGoogle, enterGuestMode } = useAuth();
  const { locale } = useLocaleControl();
  const google = useGoogleSignIn();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  const [guestPending, setGuestPending] = useState(false);
  const linkHitSlop = (theme.sizes.touchTarget - theme.lineHeight.md) / 2;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodFormResolver(loginSchema, t),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values);
    } catch (error) {
      setSubmitError(messageOf(error, t));
    }
  });

  async function onGoogleSignIn() {
    setSubmitError(null);
    setGooglePending(true);
    try {
      const idToken = await google.signIn();
      if (idToken === null) {
        setSubmitError(t('auth.googleSignInFailed'));
        return;
      }
      // Only read when this sign-in creates the account: they name and date the wallet the server sets up.
      await loginWithGoogle({ idToken, locale, timeZone: deviceTimeZone() });
    } catch (error) {
      setSubmitError(messageOf(error, t));
    } finally {
      setGooglePending(false);
    }
  }

  /** Seeds the local wallet on first entry, so the app opens on real data rather than an empty shell. */
  async function onContinueAsGuest() {
    setSubmitError(null);
    setGuestPending(true);
    try {
      await enterGuestMode();
    } catch (error) {
      setSubmitError(messageOf(error, t));
    } finally {
      setGuestPending(false);
    }
  }

  return (
    <AnimatedScreen testID="screen-login" style={{ backgroundColor: theme.colors.background }}>
      <AuthPreferences />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="flex-grow justify-center"
          contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.md }}
        >
          <Text variant="heading" style={{ marginBottom: theme.spacing.xs }}>
            {t('auth.loginTitle')}
          </Text>
          <Text tone="muted" style={{ marginBottom: theme.spacing.lg }}>
            {t('auth.loginSubtitle')}
          </Text>

          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <Input
                testID="input-login-email"
                label={t('auth.emailLabel')}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.email?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field }) => (
              <Input
                testID="input-login-password"
                label={t('auth.passwordLabel')}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errors.password?.message}
              />
            )}
          />

          {submitError !== null ? (
            <Text tone="danger" testID="login-error">
              {submitError}
            </Text>
          ) : null}

          <Button
            testID="btn-submit-login"
            label={t('auth.loginButton')}
            icon={LogIn}
            onPress={onSubmit}
            loading={isSubmitting}
            fullWidth
            style={{ marginTop: theme.spacing.sm }}
          />

          {google.available ? (
            <>
              <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
                <ThemedView className="flex-1" style={{ height: theme.borderWidth.thin, backgroundColor: theme.colors.border }} />
                <Text variant="caption" tone="muted">
                  {t('auth.orDivider')}
                </Text>
                <ThemedView className="flex-1" style={{ height: theme.borderWidth.thin, backgroundColor: theme.colors.border }} />
              </View>

              <Button
                testID="login-google"
                label={t('auth.continueWithGoogle')}
                icon={GoogleLogo}
                variant="secondary"
                onPress={() => void onGoogleSignIn()}
                loading={googlePending}
                fullWidth
              />
            </>
          ) : null}

          <View className="flex-row flex-wrap justify-center items-center" style={{ gap: theme.spacing.xs, marginTop: theme.spacing.md }}>
            <Text tone="muted">{t('auth.noAccountPrompt')}</Text>
            <Pressable
              testID="login-go-register"
              accessibilityRole="link"
              onPress={() => navigation.navigate('Register')}
              hitSlop={linkHitSlop}
            >
              <Text weight="semibold" style={{ color: theme.colors.primary }}>
                {t('auth.signUpLink')}
              </Text>
            </Pressable>
          </View>

          <View className="flex-row flex-wrap justify-center items-center" style={{ gap: theme.spacing.xs, marginTop: theme.spacing.xs }}>
            <Text tone="muted">{t('auth.guestPrompt')}</Text>
            <Pressable
              testID="login-continue-as-guest"
              accessibilityRole="link"
              accessibilityState={{ busy: guestPending }}
              onPress={() => void onContinueAsGuest()}
              disabled={guestPending}
              hitSlop={linkHitSlop}
            >
              <Text weight="semibold" style={{ color: guestPending ? theme.colors.textMuted : theme.colors.primary }}>
                {t('auth.continueAsGuestLink')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AnimatedScreen>
  );
}
