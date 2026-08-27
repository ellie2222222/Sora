import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { registerSchema } from '@sora/contracts';
import type { z } from 'zod';

import { Button, Input, Text } from '../../../components/index.ts';
import { useAuth } from '../../../app/providers/AuthProvider.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { messageOf } from '../../../utils/errors.ts';
import type { AuthStackScreenProps } from '../../../app/navigation/types.ts';

export function RegisterScreen({ navigation }: AuthStackScreenProps<'Register'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { register } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The pre-.default() input type, not the output RegisterRequest: RHF's values
  // (and defaultValues) are what the user has typed so far, where baseCurrency
  // is genuinely optional until Zod fills it in on submit.
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', displayName: '', baseCurrency: 'VND' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      // The field is defaulted in defaultValues, so this is never actually
      // undefined at submit time — the fallback only satisfies the type the
      // pre-default input shape carries.
      await register({ ...values, baseCurrency: values.baseCurrency ?? 'VND' });
    } catch (error) {
      setSubmitError(messageOf(error));
    }
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: theme.spacing.xl,
          gap: theme.spacing.md,
        }}
      >
        <Text variant="heading" style={{ marginBottom: theme.spacing.xs }}>
          {t('auth.registerTitle')}
        </Text>
        <Text tone="muted" style={{ marginBottom: theme.spacing.lg }}>
          {t('auth.registerSubtitle')}
        </Text>

        <Controller
          control={control}
          name="displayName"
          render={({ field }) => (
            <Input
              testID="register-name"
              label={t('auth.displayNameLabel')}
              value={field.value}
              onChangeText={field.onChange}
              error={errors.displayName?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Input
              testID="register-email"
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
              testID="register-password"
              label={t('auth.passwordLabel')}
              secureTextEntry
              autoCapitalize="none"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.password?.message}
            />
          )}
        />

        {submitError !== null ? (
          <Text tone="danger" testID="register-error">
            {submitError}
          </Text>
        ) : null}

        <Button
          testID="register-submit"
          label={t('auth.registerButton')}
          onPress={onSubmit}
          loading={isSubmitting}
          fullWidth
          style={{ marginTop: theme.spacing.sm }}
        />

        <Button
          testID="register-go-login"
          label={t('auth.hasAccount')}
          variant="ghost"
          onPress={() => navigation.navigate('Login')}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
