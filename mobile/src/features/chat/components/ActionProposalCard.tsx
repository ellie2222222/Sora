import { Check, X } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AiActionStatus, TransactionType, type AiActionResponse } from '@sora/contracts';

import { Button, Money, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { dayOfInstant, formatDay } from '@/utils';

/**
 * A transaction the assistant drafted. Nothing is recorded until Confirm, which
 * the server runs through the same checks as the transaction form.
 */
export function ActionProposalCard({
  messageId,
  action,
  blockedReason,
  isBusy,
  onConfirm,
  onDismiss,
}: {
  messageId: string;
  action: AiActionResponse;
  /** Why it cannot be confirmed right now (offline, view-only), shown instead of the buttons. */
  blockedReason: string | null;
  isBusy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  // The assistant reads the active wallet, so its draft's day is that wallet's.
  const { timeZone } = useWallets();
  const { t } = useTranslation();
  const { transaction } = action;
  const isIncome = transaction.type === TransactionType.INCOME;

  return (
    <View
      testID={`card-ai-action-${messageId}`}
      style={{
        marginTop: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        gap: theme.spacing.xs,
      }}
    >
      <Text variant="label" tone="muted">
        {isIncome ? t('ai.proposal.income') : t('ai.proposal.expense')}
      </Text>
      <Money amount={transaction.amount} currency={transaction.currency} type={transaction.type} variant="title" />
      <Text variant="caption" tone="muted">
        {action.accountName} · {action.categoryName} · {formatDay(dayOfInstant(transaction.transactionDate, timeZone))}
      </Text>

      {action.status === AiActionStatus.PENDING ? (
        blockedReason === null ? (
          <View className="flex-row" style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
            <Button
              testID={`btn-confirm-ai-action-${messageId}`}
              label={t('ai.proposal.confirm')}
              icon={Check}
              size="sm"
              loading={isBusy}
              disabled={isBusy}
              onPress={onConfirm}
            />
            <Button
              testID={`btn-dismiss-ai-action-${messageId}`}
              label={t('ai.proposal.dismiss')}
              icon={X}
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onPress={onDismiss}
            />
          </View>
        ) : (
          <Text variant="caption" tone="faint">
            {blockedReason}
          </Text>
        )
      ) : (
        <Text variant="caption" weight="semibold" tone={action.status === AiActionStatus.CONFIRMED ? 'success' : 'faint'}>
          {action.status === AiActionStatus.CONFIRMED ? t('ai.proposal.recorded') : t('ai.proposal.dismissed')}
        </Text>
      )}
    </View>
  );
}
