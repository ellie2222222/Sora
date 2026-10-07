import { useTranslation } from 'react-i18next';
import type { TransactionResponse } from '@sora/contracts';

import { MutationConfirmDialog } from '@/components';
import { useDeleteTransactionMutation } from '@/app/store';

export interface DeleteTransactionDialogProps {
  /** The transaction to confirm deleting; null hides the dialog. */
  transaction: TransactionResponse | null;
  onCancel: () => void;
  onDeleted: () => void;
  /** The caller clears `transaction` (hiding the dialog) and decides where the message shows. */
  onError: (message: string) => void;
}

export function DeleteTransactionDialog({ transaction, onCancel, onDeleted, onError }: DeleteTransactionDialogProps) {
  const { t } = useTranslation();
  const [deleteTransaction] = useDeleteTransactionMutation();

  return (
    <MutationConfirmDialog
      visible={transaction !== null}
      title={t('transactions.cancelConfirmTitle', { defaultValue: 'Delete this transaction?' })}
      message={t('transactions.cancelConfirmBody', {
        defaultValue: "This removes it from your list and from your balances and budgets. This can't be undone.",
      })}
      confirmLabel={t('transactions.cancelTransaction', { defaultValue: 'Delete transaction' })}
      run={() => deleteTransaction({ transactionId: transaction!.id }).unwrap()}
      onCancel={onCancel}
      onDone={onDeleted}
      onError={onError}
    />
  );
}
