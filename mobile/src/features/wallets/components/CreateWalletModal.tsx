import { useTranslation } from 'react-i18next';

import { BottomSheetModal } from '@/components';
import { CreateWalletForm } from './CreateWalletForm.tsx';

export function CreateWalletModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('wallets.newWallet')} testID="sheet-wallet-create">
      <CreateWalletForm active={visible} onCreated={onClose} />
    </BottomSheetModal>
  );
}
