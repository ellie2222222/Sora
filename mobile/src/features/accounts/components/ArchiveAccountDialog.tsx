import { useTranslation } from 'react-i18next';

import { MutationConfirmDialog } from '@/components';
import { useArchiveAccountMutation } from '@/app/store';

export interface ArchiveAccountDialogProps {
  /** The account to confirm archiving; null hides the dialog. */
  accountId: string | null;
  onCancel: () => void;
  onArchived: () => void;
  /** The caller clears `accountId` (hiding the dialog) and decides where the message shows, e.g. the wallet's last account. */
  onError: (message: string) => void;
}

export function ArchiveAccountDialog({ accountId, onCancel, onArchived, onError }: ArchiveAccountDialogProps) {
  const { t } = useTranslation();
  const [archiveAccount] = useArchiveAccountMutation();

  return (
    <MutationConfirmDialog
      visible={accountId !== null}
      title={t('accounts.archiveConfirmTitle')}
      message={t('accounts.archiveConfirmMessage')}
      confirmLabel={t('common.archive')}
      run={() => archiveAccount(accountId!).unwrap()}
      onCancel={onCancel}
      onDone={onArchived}
      onError={onError}
    />
  );
}
