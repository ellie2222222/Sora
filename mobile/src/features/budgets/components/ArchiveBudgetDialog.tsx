import { useTranslation } from 'react-i18next';

import { MutationConfirmDialog } from '@/components';
import { useArchiveBudgetMutation } from '@/app/store';

export interface ArchiveBudgetDialogProps {
  /** The budget to confirm archiving; null hides the dialog. */
  budgetId: string | null;
  onCancel: () => void;
  onArchived: () => void;
  /** The caller clears `budgetId` (hiding the dialog) and decides where the message shows. */
  onError: (message: string) => void;
}

export function ArchiveBudgetDialog({ budgetId, onCancel, onArchived, onError }: ArchiveBudgetDialogProps) {
  const { t } = useTranslation();
  const [archiveBudget] = useArchiveBudgetMutation();

  return (
    <MutationConfirmDialog
      visible={budgetId !== null}
      title={t('budgets.archiveConfirmTitle', 'Archive this budget?')}
      message={t('budgets.archiveConfirmMessage', 'It stops tracking new spending. Past figures stay visible.')}
      confirmLabel={t('common.archive', 'Archive')}
      run={() => archiveBudget(budgetId!).unwrap()}
      onCancel={onCancel}
      onDone={onArchived}
      onError={onError}
    />
  );
}
