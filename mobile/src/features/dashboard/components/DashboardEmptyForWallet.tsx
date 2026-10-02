import { DashboardEmpty } from './DashboardEmpty';
import { useModal, useWallets } from '@/app/providers';
import type { DashboardEmptyReason } from '@/utils';

export function DashboardEmptyForWallet({
  reason,
  walletId,
  periodLabel,
  onPreviousPeriod,
}: {
  reason: DashboardEmptyReason;
  walletId: string;
  periodLabel: string;
  onPreviousPeriod: () => void;
}) {
  const { openModal } = useModal();
  const { permissions } = useWallets();

  return (
    <DashboardEmpty
      reason={reason}
      periodLabel={periodLabel}
      canWrite={permissions.canWrite}
      onAddAccount={() => openModal('AddAccount', { walletId })}
      onAddTransaction={() => openModal('AddTransaction')}
      onPreviousPeriod={onPreviousPeriod}
    />
  );
}
