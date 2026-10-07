import type { LucideIcon } from 'lucide-react-native';
import { Inbox, Info, Search, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { getServerErrorMessage, isNetworkError, isUnauthenticated } from '@/utils';
import { AnimatedIcon, type IconAnimationType } from './AnimatedIcon';
import { Button } from './Button';
import { SlideUp } from './SlideUp';
import { Text } from './Text';

export type StateViewVariant = 'empty' | 'error' | 'no-results' | 'informational';

export interface StateViewAction {
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

const VARIANT_ANIMATION: Record<StateViewVariant, IconAnimationType> = {
  empty: 'float',
  error: 'pulse',
  'no-results': 'none',
  informational: 'none',
};

export function StateView({
  variant,
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

  if (variant === 'error' && isSelfResolvingError(error, [title, message], t('errors.offlineTitle', "You're offline"))) {
    return null;
  }

  const Icon = icon ?? VARIANT_ICON[variant];

  const defaultTitles: Record<StateViewVariant, string> = {
    empty: t('errors.nothingHereYet', 'Nothing here yet'),
    error: isNetworkError(error)
      ? t('errors.offlineTitle', "You're offline")
      : t('errors.somethingWentWrong', 'Something went wrong. Please try again.'),
    'no-results': t('errors.noResultsFound', 'No results found'),
    informational: t('errors.nothingHereYet', 'Nothing here yet'),
  };

  const errorMessage = variant === 'error' && error !== undefined
    ? (isNetworkError(error) ? t('errors.offlineTitle', "You're offline") : getServerErrorMessage(error, t))
    : undefined;

  const resolvedTitle = title ?? errorMessage ?? defaultTitles[variant];
  const resolvedMessage = message ?? (title !== undefined ? errorMessage : undefined);

  const resolvedPrimary =
    primaryAction ??
    (retryAction !== undefined
      ? { label: t('common.tryAgain', 'Try again'), onPress: retryAction }
      : undefined);

  const resolvedIconColor =
    iconColor ?? (variant === 'error' ? theme.colors.danger : theme.colors.primary);

  const containerStyle = {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: theme.spacing.xxl,
    gap: theme.spacing.sm,
  };

  const content = (
    <>
      <AnimatedIcon
        icon={Icon}
        size={theme.iconSize.hero}
        color={resolvedIconColor}
        strokeWidth={theme.iconStroke.thin}
        animation={VARIANT_ANIMATION[variant]}
      />
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
          testID={testID !== undefined ? `${testID}-${variant === 'error' ? 'retry' : 'action'}` : undefined}
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
              key={action.label}
              action={action}
              testID={testID !== undefined ? `${testID}-quick-${action.label}` : undefined}
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
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={action.onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
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
      {Icon !== undefined ? <Icon size={theme.iconSize.sm} color={theme.colors.primary} /> : null}
      <Text variant="caption" weight="medium">
        {action.label}
      </Text>
    </Pressable>
  );
}

const CONNECTIVITY_WORDS = ['internet', 'offline', 'network', 'connection'];

/**
 * Offline and an unrecoverable 401 resolve themselves elsewhere (local-data fallback; the refresh
 * interceptor switches to AuthNavigator), so a banner would only flash and vanish.
 */
function isSelfResolvingError(error: unknown, texts: readonly unknown[], offlineTitle: string): boolean {
  if (isNetworkError(error) || isUnauthenticated(error)) return true;
  return texts.some(
    (text) =>
      typeof text === 'string' &&
      (text === offlineTitle || CONNECTIVITY_WORDS.some((word) => text.toLowerCase().includes(word))),
  );
}
