import { useState, type ReactNode } from 'react';

// Deep-imported (not via each feature's barrel): a barrel import here would
// pull in that feature's other files too, several of which import back from
// this file's own `app/providers` barrel — a require cycle.
import { AddAccountModal } from '../../features/accounts/components/AddAccountModal.tsx';
import { AddBudgetModal } from '../../features/budgets/components/AddBudgetModal.tsx';
import { AddContributionModal } from '../../features/goals/components/AddContributionModal.tsx';
import { AddGoalModal } from '../../features/goals/components/AddGoalModal.tsx';
import { AddTransactionModal } from '../../features/transactions/components/AddTransactionModal.tsx';
import { EditTransactionModal } from '../../features/transactions/components/EditTransactionModal.tsx';
import { CreateWalletModal } from '../../features/wallets/components/CreateWalletModal.tsx';
import { ModalContext, type ModalParams, type ModalType } from './ModalContext.ts';

export function ModalProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const [modalParams, setModalParams] = useState<ModalParams>({});

  const openModal = (type: ModalType, params: ModalParams = {}) => {
    setModalParams(params);
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    setModalParams({});
  };

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}

      <AddTransactionModal
        visible={activeModal === 'AddTransaction'}
        onClose={closeModal}
      />

      <EditTransactionModal
        visible={activeModal === 'EditTransaction'}
        transactionId={modalParams.transactionId}
        onClose={closeModal}
      />

      <AddAccountModal
        visible={activeModal === 'AddAccount'}
        walletId={modalParams.walletId}
        initialType={modalParams.accountType}
        onClose={closeModal}
      />

      <AddGoalModal
        visible={activeModal === 'AddGoal'}
        onClose={closeModal}
      />

      <AddBudgetModal
        visible={activeModal === 'AddBudget'}
        onClose={closeModal}
      />

      <AddContributionModal
        visible={activeModal === 'AddContribution'}
        goalId={modalParams.goalId}
        onClose={closeModal}
      />

      <CreateWalletModal
        visible={activeModal === 'CreateWallet'}
        onClose={closeModal}
      />
    </ModalContext.Provider>
  );
}
