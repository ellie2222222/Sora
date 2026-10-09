import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { AlertCircle, Info, TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { BottomSheetModal } from './BottomSheetModal';
import { Button } from './Button';
import { Input } from './Input';
import { Text } from './Text';

export type ConfirmDialogVariant = 'danger' | 'warning' | 'info' | 'primary';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  /** Renders the confirm button as `danger` instead of `primary` (legacy shorthand, equivalent to variant="danger"). */
  destructive?: boolean;
  icon?: LucideIcon;
  loading?: boolean;
  /**
   * Exact text the user must type to enable confirmation (e.g. "clear data" or "DELETE").
   * When specified, renders an Input field in the dialog.
   */
  matchText?: string;
  /** Optional custom instruction label above the match input field. */
  matchTextLabel?: string;
  /** Optional placeholder for the match input field. Defaults to `matchText`. */
  matchTextPlaceholder?: string;
  /** Whether matching is case-insensitive. Default: false (case-sensitive). */
  matchTextIgnoreCase?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_DEFAULT_ICON: Record<ConfirmDialogVariant, LucideIcon> = {
  danger: TriangleAlert,
  warning: AlertCircle,
  info: Info,
  primary: Info,
};

/**
 * Built on `BottomSheetModal` so it shares that sheet's motion, anchoring, safe area and drag gestures.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant,
  destructive = false,
  icon,
  loading = false,
  matchText,
  matchTextLabel,
  matchTextPlaceholder,
  matchTextIgnoreCase = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    if (visible) setInputText('');
  }, [visible]);

  const resolvedCancelLabel = cancelLabel ?? t('common.cancel');
  const resolvedVariant: ConfirmDialogVariant = variant ?? (destructive ? 'danger' : 'primary');
  const IconComponent = icon ?? VARIANT_DEFAULT_ICON[resolvedVariant];

  const iconColor = {
    danger: theme.colors.danger,
    warning: theme.colors.warning,
    info: theme.colors.info,
    primary: theme.colors.primary,
  }[resolvedVariant];

  const iconBgColor = {
    danger: theme.colors.dangerMuted,
    warning: theme.colors.warningMuted,
    info: theme.colors.infoMuted,
    primary: theme.colors.primaryMuted,
  }[resolvedVariant];

  const confirmBtnVariant = resolvedVariant === 'danger' ? 'danger' : 'primary';

  const isMatchRequired = Boolean(matchText && matchText.trim().length > 0);
  const normalizedInput = matchTextIgnoreCase ? inputText.trim().toLowerCase() : inputText.trim();
  const normalizedMatch = matchText ? (matchTextIgnoreCase ? matchText.trim().toLowerCase() : matchText.trim()) : '';
  const isMatchValid = !isMatchRequired || normalizedInput === normalizedMatch;

  return (
    <BottomSheetModal visible={visible} onClose={onCancel}>
      <View style={{ gap: theme.spacing.lg }}>
        <View className="flex-row items-center" style={{ gap: theme.spacing.md }}>
          <View
            className="items-center justify-center"
            style={{
              width: theme.sizes.badge.lg,
              height: theme.sizes.badge.lg,
              borderRadius: theme.radius.pill,
              backgroundColor: iconBgColor,
            }}
          >
            <IconComponent size={theme.iconSize.xxl} color={iconColor} />
          </View>
          <Text variant="title" style={{ flex: 1, letterSpacing: theme.letterSpacing.wide }}>
            {title}
          </Text>
        </View>

        {message !== undefined ? (
          <Text tone="muted" style={{ lineHeight: theme.lineHeight.lg, letterSpacing: theme.letterSpacing.wide }}>
            {message}
          </Text>
        ) : null}

        {isMatchRequired ? (
          <View style={{ gap: theme.spacing.xs }}>
            <Text variant="caption" tone="muted" style={{ letterSpacing: theme.letterSpacing.wide }}>
              {matchTextLabel ?? t('common.matchConfirmPrompt', { word: matchText })}
            </Text>
            <Input
              testID="input-confirm-dialog-match"
              value={inputText}
              onChangeText={setInputText}
              placeholder={matchTextPlaceholder ?? matchText}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ) : null}

        <View className="flex-row" style={{ gap: theme.spacing.md, marginTop: theme.spacing.xs }}>
          <Button label={resolvedCancelLabel} variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
          <Button
            testID="btn-confirm-dialog"
            label={confirmLabel}
            variant={confirmBtnVariant}
            loading={loading}
            disabled={!isMatchValid}
            onPress={() => {
              if (isMatchValid) {
                onConfirm();
              }
            }}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}
