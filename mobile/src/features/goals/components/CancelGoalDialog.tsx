import { useTranslation } from 'react-i18next';

import { MutationConfirmDialog } from '@/components';
import { useCancelGoalMutation } from '@/app/store';

export interface CancelGoalDialogProps {
  /** The goal to confirm cancelling; null hides the dialog. */
  goalId: string | null;
  onCancel: () => void;
  onCancelled: () => void;
  /** The caller clears `goalId` (hiding the dialog) and decides where the message shows. */
  onError: (message: string) => void;
}

export function CancelGoalDialog({ goalId, onCancel, onCancelled, onError }: CancelGoalDialogProps) {
  const { t } = useTranslation();
  const [cancelGoal] = useCancelGoalMutation();

  return (
    <MutationConfirmDialog
      visible={goalId !== null}
      title={t('goals.cancelConfirmTitle')}
      message={t('goals.cancelConfirmMessage')}
      confirmLabel={t('goals.cancelGoal')}
      cancelLabel={t('goals.keepGoal')}
      run={() => cancelGoal(goalId!).unwrap()}
      onCancel={onCancel}
      onDone={onCancelled}
      onError={onError}
    />
  );
}
