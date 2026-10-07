import { useTranslation } from 'react-i18next';

import { MutationConfirmDialog } from '@/components';
import { useDeleteBudgetMutation } from '@/app/store';

export interface DeleteBudgetDialogProps {
  /** The budget to confirm deleting; null hides the dialog. */
  budgetId: string | null;
  onCancel: () => void;
  onDeleted: () => void;
  /** The caller clears `budgetId` (hiding the dialog) and decides where the message shows. */
  onError: (message: string) => void;
}

export function DeleteBudgetDialog({ budgetId, onCancel, onDeleted, onError }: DeleteBudgetDialogProps) {
  const { t } = useTranslation();
  const [deleteBudget] = useDeleteBudgetMutation();

  return (
    <MutationConfirmDialog
      visible={budgetId !== null}
      title={t('budgets.deleteConfirmTitle')}
      message={t('budgets.deleteConfirmMessage')}
      confirmLabel={t('common.delete')}
      run={() => deleteBudget(budgetId!).unwrap()}
      onCancel={onCancel}
      onDone={onDeleted}
      onError={onError}
    />
  );
}
