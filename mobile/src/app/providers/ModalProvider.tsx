import { useCallback, useMemo, useState, type ReactNode } from 'react';

// Deep-imported (not via each feature's barrel): a barrel import here would
// pull in that feature's other files too, several of which import back from
// this file's own `app/providers` barrel — a require cycle.
import { AddAccountModal } from '../../features/accounts/components/AddAccountModal.tsx';
import { AddBudgetModal } from '../../features/budgets/components/AddBudgetModal.tsx';
import { AddContributionModal } from '../../features/goals/components/AddContributionModal.tsx';
import { AddGoalModal } from '../../features/goals/components/AddGoalModal.tsx';
import { TransactionFormModal } from '../../features/transactions/components/TransactionFormModal.tsx';
import { CreateWalletModal } from '../../features/wallets/components/CreateWalletModal.tsx';
import { ModalContext, type ModalParams, type ModalType } from './ModalContext.ts';

export function ModalProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const [modalParams, setModalParams] = useState<ModalParams>({});

  // Stable, so memoized list rows that receive an open handler don't all re-render whenever a modal opens.
  const openModal = useCallback((type: ModalType, params: ModalParams = {}) => {
    setModalParams(params);
    setActiveModal(type);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalParams({});
  }, []);

  const contextValue = useMemo(() => ({ openModal, closeModal }), [openModal, closeModal]);

  const { parent } = modalParams;
  const back =
    parent === undefined
      ? undefined
      : () => {
          closeModal();
          parent.onBack?.();
        };

  return (
    <ModalContext.Provider value={contextValue}>
      {children}

      <TransactionFormModal
        visible={activeModal === 'AddTransaction'}
        onClose={closeModal}
      />

      <TransactionFormModal
        visible={activeModal === 'EditTransaction'}
        transactionId={modalParams.transactionId}
        onClose={closeModal}
        onCloseAll={parent?.onClose}
        onBack={back}
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
        onCloseAll={parent?.onClose}
        onBack={back}
      />

      <CreateWalletModal
        visible={activeModal === 'CreateWallet'}
        onClose={closeModal}
      />
    </ModalContext.Provider>
  );
}
