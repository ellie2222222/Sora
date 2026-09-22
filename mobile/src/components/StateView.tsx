import type { LucideIcon } from 'lucide-react-native';
import { Inbox, Info, Search, TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { getServerErrorMessage, isNetworkError } from '@/utils';
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
  retryAction?: () => void;
  testID?: string;
  /**
   * 'bounce' (default) fades and springs up from below — a screen's first appearance.
   * 'none' renders with no entrance animation of its own, for a state view sitting inside content
   * that already has its own transition (e.g. a container that slides per date navigation) —
   * animating here too would double up on top of that transition.
   */
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

/**
 * Centered icon, title, optional message, and optional action(s) for screen/section states.
 */
export function StateView({
  variant,
  icon,
  iconColor,
  title,
  message,
  error,
  primaryAction,
  secondaryAction,
  retryAction,
  testID,
  entrance = 'bounce',
}: StateViewProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  // Never render error state view on network errors / offline — silently fallback to local data.
  // The string checks below are a backstop for callers that pass a plain
  // title/message instead of the original `error` (so `isNetworkError` alone
  // can't see it) — fragile against copy changes and only checks English
  // substrings, but there's no `error` object left to check by then.
  if (
    variant === 'error' &&
    (isNetworkError(error) ||
      title === t('errors.offlineTitle', 'No internet connection') ||
      message === t('errors.offlineTitle', 'No internet connection') ||
      (typeof title === 'string' &&
        (title.toLowerCase().includes('internet') ||
          title.toLowerCase().includes('offline') ||
          title.toLowerCase().includes('network') ||
          title.toLowerCase().includes('connection'))) ||
      (typeof message === 'string' &&
        (message.toLowerCase().includes('internet') ||
          message.toLowerCase().includes('offline') ||
          message.toLowerCase().includes('network') ||
          message.toLowerCase().includes('connection'))))
  ) {
    return null;
  }

  const Icon = icon ?? VARIANT_ICON[variant];

  const defaultTitles: Record<StateViewVariant, string> = {
    empty: t('errors.nothingHereYet', 'Nothing here yet'),
    error: isNetworkError(error)
      ? t('errors.offlineTitle', 'No internet connection')
      : t('errors.somethingWentWrong', 'Something went wrong'),
    'no-results': t('errors.noResultsFound', 'No results found'),
    informational: t('errors.nothingHereYet', 'Nothing here yet'),
  };

  const errorMessage = variant === 'error' && error !== undefined
    ? (isNetworkError(error) ? t('errors.offlineTitle', 'No internet connection') : getServerErrorMessage(error, t))
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
        size={42}
        color={resolvedIconColor}
        strokeWidth={1.5}
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
