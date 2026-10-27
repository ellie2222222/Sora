import type { LucideIcon } from 'lucide-react-native';
import { CloudOff, Inbox, Info, Search, TriangleAlert, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { getServerErrorMessage, isApiError, isDeviceOnline, isNetworkError, isUnauthenticated, noResponseMessage } from '@/utils';
import { Button } from './Button';
import { SlideUp } from './SlideUp';
import { Text } from './Text';
import { ThemedIcon, ThemedPressable } from './Themed.tsx';

export type StateViewVariant = 'empty' | 'error' | 'no-results' | 'informational';

export interface StateViewAction {
  /** Stable id for the quick-action chip's testID; falls back to `label`. */
  id?: string;
  label: string;
  onPress: () => void;
  loading?: boolean;
  icon?: LucideIcon;
}

export interface StateViewProps {
  variant: StateViewVariant;
  icon?: LucideIcon;
  iconColor?: string;
  title?: string;
  message?: string;
  error?: unknown;
  primaryAction?: StateViewAction;
  secondaryAction?: StateViewAction;
  /** Presets rendered as a chip row under the buttons, for a first-run screen. */
  quickActions?: StateViewAction[];
  retryAction?: () => void;
  testID?: string;
  /** 'none' skips the entrance animation, for a view inside content that already has its own transition. */
  entrance?: 'bounce' | 'none';
}

const VARIANT_ICON: Record<StateViewVariant, LucideIcon> = {
  empty: Inbox,
  error: TriangleAlert,
  'no-results': Search,
  informational: Info,
};

export function StateView({
  variant: requestedVariant,
  icon,
  iconColor,
  title,
  message,
  error,
  primaryAction,
  secondaryAction,
  quickActions,
  retryAction,
  testID,
  entrance = 'bounce',
}: StateViewProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  // The refresh interceptor answers an unrecoverable 401 by switching to sign-in, so a banner would only flash.
  if (requestedVariant === 'error' && isUnauthenticated(error)) return null;

  // No answer from the API is not a failure of the screen: a saved copy is answered before it ever gets here,
  // so this is data the device has never held. Say so calmly and offer a retry, never a red error.
  const unreachable = requestedVariant === 'error' && isNetworkError(error);
  const variant: StateViewVariant = unreachable ? 'informational' : requestedVariant;

  const Icon = icon ?? (unreachable ? (isDeviceOnline() ? CloudOff : WifiOff) : VARIANT_ICON[variant]);

  const defaultTitles: Record<StateViewVariant, string> = {
    empty: t('errors.nothingHereYet'),
    error: t('errors.somethingWentWrong'),
    'no-results': t('errors.noResultsFound'),
    informational: t('errors.nothingHereYet'),
  };

  const errorMessage = unreachable
    ? noResponseMessage(t)
    : variant === 'error' && error !== undefined
      ? describeError(error, t)
      : undefined;

  const resolvedTitle = title ?? errorMessage ?? defaultTitles[variant];
  const resolvedMessage =
    message ?? (title !== undefined ? errorMessage : unreachable ? t('errors.notSavedOnDevice') : undefined);

  const resolvedPrimary =
    primaryAction ??
    (retryAction !== undefined
      ? { label: t('common.tryAgain'), onPress: retryAction }
      : undefined);

  const resolvedIconColor =
    iconColor ?? (variant === 'error' ? theme.colors.danger : unreachable ? theme.colors.warning : theme.colors.primary);

  const containerStyle = {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: theme.spacing.xxl,
    gap: theme.spacing.sm,
  };

  const content = (
    <>
      <ThemedIcon icon={Icon} size={theme.iconSize.hero} color={resolvedIconColor} strokeWidth={theme.iconStroke.thin} />
      <Text
        variant="title"
        tone={variant === 'error' ? 'danger' : 'default'}
        style={{ textAlign: 'center', marginTop: theme.spacing.sm }}
      >
        {resolvedTitle}
      </Text>
      {resolvedMessage !== undefined ? (
        <Text variant="body" tone="muted" style={{ textAlign: 'center' }}>
          {resolvedMessage}
        </Text>
      ) : null}
      {resolvedPrimary !== undefined ? (
        <Button
          label={resolvedPrimary.label}
          variant={variant === 'error' ? 'secondary' : 'primary'}
          onPress={resolvedPrimary.onPress}
          loading={resolvedPrimary.loading}
          icon={resolvedPrimary.icon}
          style={{ marginTop: theme.spacing.md, alignSelf: 'center' }}
          testID={testID !== undefined ? `${testID}-${requestedVariant === 'error' ? 'retry' : 'action'}` : undefined}
        />
      ) : null}
      {secondaryAction !== undefined ? (
        <Button
          label={secondaryAction.label}
          variant="ghost"
          onPress={secondaryAction.onPress}
          loading={secondaryAction.loading}
          icon={secondaryAction.icon}
          style={{ alignSelf: 'center' }}
          testID={testID !== undefined ? `${testID}-secondary-action` : undefined}
        />
      ) : null}
      {quickActions !== undefined && quickActions.length > 0 ? (
        <View
          className="flex-row flex-wrap justify-center"
          style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}
        >
          {quickActions.map((action) => (
            <QuickActionChip
              key={action.id ?? action.label}
              action={action}
              testID={testID !== undefined ? `${testID}-quick-${action.id ?? action.label}` : undefined}
            />
          ))}
        </View>
      ) : null}
    </>
  );

  if (entrance === 'none') {
    return (
      <View testID={testID} style={containerStyle}>
        {content}
      </View>
    );
  }

  return (
    <SlideUp testID={testID} style={containerStyle}>
      {content}
    </SlideUp>
  );
}

function QuickActionChip({ action, testID }: { action: StateViewAction; testID?: string }) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);
  const Icon = action.icon;

  return (
    <ThemedPressable
      testID={testID}
      accessibilityRole="button"
      onPress={action.onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={{ top: theme.sizes.hitSlop.md, bottom: theme.sizes.hitSlop.md }}
      className="flex-row items-center"
      style={{
        gap: theme.spacing.xs,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.pill,
        borderWidth: theme.borderWidth.thin,
        borderColor: pressed ? theme.colors.primary : theme.colors.border,
        backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
      }}
    >
      {Icon !== undefined ? <ThemedIcon icon={Icon} size={theme.iconSize.sm} color={theme.colors.primary} /> : null}
      <Text variant="caption" weight="medium">
        {action.label}
      </Text>
    </ThemedPressable>
  );
}

/** A screen's own `new Error(t(...))` already says what went wrong; only an API error needs its code translated. */
function describeError(error: unknown, t: (key: string) => string): string {
  if (!isApiError(error) && error instanceof Error && error.message !== '') return error.message;
  return getServerErrorMessage(error, t);
}
