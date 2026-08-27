import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { loginSchema, type LoginRequest } from '@sora/contracts';

import { Button, Input, Text } from '../../../components/index.ts';
import { useAuth } from '../../../app/providers/AuthProvider.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { messageOf } from '../../../utils/errors.ts';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn.ts';
import type { AuthStackScreenProps } from '../../../app/navigation/types.ts';

export function LoginScreen({ navigation }: AuthStackScreenProps<'Login'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { login, loginWithGoogle } = useAuth();
  const google = useGoogleSignIn();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values);
    } catch (error) {
      setSubmitError(messageOf(error));
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
      await loginWithGoogle({ idToken });
    } catch (error) {
      setSubmitError(messageOf(error));
    } finally {
      setGooglePending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.xl, gap: theme.spacing.md }}>
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
              testID="login-email"
              label={t('auth.emailLabel')}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <Input
              testID="login-password"
              label={t('auth.passwordLabel')}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              value={field.value}
              onChangeText={field.onChange}
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
          testID="login-submit"
          label={t('auth.loginButton')}
          onPress={onSubmit}
          loading={isSubmitting}
          fullWidth
          style={{ marginTop: theme.spacing.sm }}
        />

        {google.available ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
              <Text variant="caption" tone="faint">
                {t('auth.orDivider')}
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
            </View>

            <Button
              testID="login-google"
              label={t('auth.continueWithGoogle')}
              variant="secondary"
              onPress={() => void onGoogleSignIn()}
              loading={googlePending}
              fullWidth
            />
          </>
        ) : null}

        <Button
          testID="login-go-register"
          label={t('auth.goToRegister')}
          variant="ghost"
          onPress={() => navigation.navigate('Register')}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
