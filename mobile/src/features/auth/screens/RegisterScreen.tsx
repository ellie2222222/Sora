import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type TextInput } from 'react-native';

import { UserPlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { registerSchema } from '@sora/contracts';

// The first wallet takes this device's zone; its owner can change it in the wallet's settings.
const registerFormSchema = registerSchema.omit({ timeZone: true });
import type { z } from 'zod';

import { AnimatedScreen, Button, Input, SegmentedControl, Text } from '@/components';
import { useAuth, useLocaleControl, useTheme } from '@/app/providers';
import { SUPPORTED_LOCALES } from '@/app/i18n';
import { deviceTimeZone, messageOf } from '@/utils';
import type { AuthStackScreenProps } from '@/app/navigation';

export function RegisterScreen({ navigation }: AuthStackScreenProps<'Register'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { register } = useAuth();
  const { locale, setLocale } = useLocaleControl();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The pre-.default() input type, not the output RegisterRequest: RHF's values
  // (and defaultValues) are what the user has typed so far, where baseCurrency
  // is genuinely optional until Zod fills it in on submit.
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof registerFormSchema>>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { email: '', password: '', displayName: '', baseCurrency: 'VND' },
  });

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      // The field is defaulted in defaultValues, so this is never actually
      // undefined at submit time — the fallback only satisfies the type the
      // pre-default input shape carries.
      // The chosen language names the wallet and Cash account the server creates for them.
      await register({ ...values, baseCurrency: values.baseCurrency ?? 'VND', locale, timeZone: deviceTimeZone() });
    } catch (error) {
      setSubmitError(messageOf(error, t));
    }
  });

  return (
    <AnimatedScreen testID="screen-register" style={{ backgroundColor: theme.colors.background }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center"
          contentContainerStyle={{
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

          <View style={{ gap: theme.spacing.xs }}>
            <Text weight="semibold" style={{ fontSize: theme.fontSize.sm }}>
              {t('auth.languageLabel')}
            </Text>
            <SegmentedControl
              options={SUPPORTED_LOCALES.map((code) => ({
                value: code,
                label: t(`settings.languageNames.${code}`),
                testID: `btn-register-locale-${code}`,
              }))}
              value={locale}
              onChange={(next) => void setLocale(next)}
            />
            <Text variant="caption" tone="muted">
              {t('auth.languageHint')}
            </Text>
          </View>

          <Controller
            control={control}
            name="displayName"
            render={({ field }) => (
              <Input
                testID="input-register-name"
                label={t('auth.displayNameLabel')}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => emailRef.current?.focus()}
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
                ref={emailRef}
                testID="input-register-email"
                label={t('auth.emailLabel')}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
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
                ref={passwordRef}
                testID="input-register-password"
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
            testID="btn-submit-register"
            label={t('auth.registerButton')}
            icon={UserPlus}
            onPress={onSubmit}
            loading={isSubmitting}
            fullWidth
            style={{ marginTop: theme.spacing.sm }}
          />

          <View
            className="flex-row justify-center items-center"
            style={{ gap: theme.spacing.xs, marginTop: theme.spacing.md }}
          >
            <Text tone="muted">{t('auth.hasAccountPrompt')}</Text>
            <Pressable testID="register-go-login" onPress={() => navigation.navigate('Login')} hitSlop={theme.sizes.hitSlop.md}>
              <Text weight="semibold" style={{ color: theme.colors.primary }}>
                {t('auth.signInLink')}
              </Text>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </AnimatedScreen>
  );
}
