import { useEffect, useRef, useState } from 'react';

import { useModal, useWallets } from '@/app/providers';
import type { MainTabScreenProps } from '@/app/navigation';
import { TransactionListScreen } from '@/features/transactions';

interface Scope {
  walletId: string | null;
  accountId: string | null;
  categoryId: string | null;
}

export function HomeScreen({ route }: MainTabScreenProps<'Home'>) {
  const { openModal } = useModal();
  const { activeWalletId, setActiveWalletId } = useWallets();
  // Tied to its wallet, so switching wallets drops filters naming another wallet's account or category.
  const [scope, setScope] = useState<Scope>({ walletId: null, accountId: null, categoryId: null });
  const requested = route.params;
  // Each navigation brings a new params object; applying one only once keeps the viewer's later picks.
  const applied = useRef<typeof requested>(undefined);

  useEffect(() => {
    if (requested === undefined || requested === applied.current) return;
    applied.current = requested;
    if (requested.walletId !== activeWalletId) setActiveWalletId(requested.walletId);
    setScope({ walletId: requested.walletId, accountId: requested.accountId ?? null, categoryId: requested.categoryId ?? null });
  }, [requested, activeWalletId, setActiveWalletId]);

  const current = scope.walletId === activeWalletId ? scope : { walletId: activeWalletId, accountId: null, categoryId: null };

  return (
    <TransactionListScreen
      accountId={current.accountId ?? undefined}
      categoryId={current.categoryId ?? undefined}
      accountFilter={{ selectedAccountId: current.accountId, onSelect: (accountId) => setScope({ ...current, accountId }) }}
      onClearCategory={() => setScope({ ...current, categoryId: null })}
      onAddTransaction={() => openModal('AddTransaction')}
      // CustomTabBar sits in normal flow below this screen, not over it, so the FAB needs no offset.
      fabBottomOffset={0}
      testIDPrefix="home"
    />
  );
}
