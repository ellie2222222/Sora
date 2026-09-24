import { useModal } from '@/app/providers';
import { TransactionListScreen } from '@/features/transactions';
import type { MainTabScreenProps } from '@/app/navigation';

export function HomeScreen({ navigation }: MainTabScreenProps<'Home'>) {
  const { openModal } = useModal();

  return (
    <TransactionListScreen
      onManage={() => navigation.getParent()?.navigate('WalletList')}
      onAddTransaction={() => openModal('AddTransaction')}
      // CustomTabBar sits in normal flow below this screen, not over it, so the FAB needs no offset.
      fabBottomOffset={0}
      testIDPrefix="home"
    />
  );
}
