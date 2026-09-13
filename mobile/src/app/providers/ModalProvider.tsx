import { createContext, useContext, useState, type ReactNode } from 'react';

import { AddAccountModal } from '../../features/accounts/components/AddAccountModal';
import { AddBudgetModal } from '../../features/budgets/components/AddBudgetModal';
import { AddContributionModal } from '../../features/goals/components/AddContributionModal';
import { AddGoalModal } from '../../features/goals/components/AddGoalModal';
import { AddTransactionModal } from '../../features/transactions/components/AddTransactionModal';
import { EditTransactionModal } from '../../features/transactions/components/EditTransactionModal';

export type ModalType =
  | 'AddTransaction'
  | 'EditTransaction'
  | 'AddAccount'
  | 'AddGoal'
  | 'AddBudget'
  | 'AddContribution';

export interface ModalParams {
  transactionId?: string;
  walletId?: string;
  goalId?: string;
}

interface ModalContextValue {
  openModal: (type: ModalType, params?: ModalParams) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

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
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextValue {
  const context = useContext(ModalContext);
  if (context === null) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
