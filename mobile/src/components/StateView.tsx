import type { LucideIcon } from 'lucide-react-native';
import { Inbox, Info, Search, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../app/providers/ThemeProvider';
import { isNetworkError, messageOf } from '../utils/errors';
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
  title?: string;
  message?: string;
  error?: unknown;
  primaryAction?: StateViewAction;
  secondaryAction?: StateViewAction;
  retryAction?: () => void;
  testID?: string;
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
  title,
  message,
  error,
  primaryAction,
  secondaryAction,
  retryAction,
  testID,
}: StateViewProps) {
  const theme = useTheme();
  const { t } = useTranslation();
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
    ? (isNetworkError(error) ? t('errors.offlineMessage', 'Your local data is still available.') : messageOf(error))
    : undefined;

  const resolvedTitle = title ?? errorMessage ?? defaultTitles[variant];
  const resolvedMessage = message ?? (title !== undefined ? errorMessage : undefined);

  const resolvedPrimary =
    primaryAction ??
    (retryAction !== undefined
      ? { label: t('common.tryAgain', 'Try again'), onPress: retryAction }
      : undefined);

  return (
    <SlideUp
      testID={testID}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xxl,
        gap: theme.spacing.sm,
      }}
    >
      <AnimatedIcon
        icon={Icon}
        size={42}
        color={variant === 'error' ? theme.colors.danger : theme.colors.textFaint}
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
    </SlideUp>
  );
}
