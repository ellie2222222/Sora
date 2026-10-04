import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type TextInput } from 'react-native';

import { UserPlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { registerSchema } from '@sora/contracts';
import type { z } from 'zod';

import { AnimatedScreen, Button, Input, Text } from '@/components';
import { useAuth, useTheme } from '@/app/providers';
import { messageOf } from '@/utils';
import type { AuthStackScreenProps } from '@/app/navigation';

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

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      // The field is defaulted in defaultValues, so this is never actually
      // undefined at submit time — the fallback only satisfies the type the
      // pre-default input shape carries.
      await register({ ...values, baseCurrency: values.baseCurrency ?? 'VND' });
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
            <Pressable testID="register-go-login" onPress={() => navigation.navigate('Login')} hitSlop={8}>
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
