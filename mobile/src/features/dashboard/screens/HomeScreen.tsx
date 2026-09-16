import { useModal } from '../../../app/providers/ModalProvider.tsx';
import { TransactionListScreen } from '@/features/transactions';
import type { MainTabScreenProps } from '@/app/navigation';

export function HomeScreen({ navigation }: MainTabScreenProps<'Home'>) {
  const { openModal } = useModal();

  return (
    <TransactionListScreen
      onManage={() => navigation.getParent()?.navigate('WalletList')}
      onAddTransaction={() => openModal('AddTransaction')}
      // CustomTabBar is a normal-flow sibling (`position: 'relative'`), not
      // an overlay, so this screen already stops right above it — no extra
      // offset needed to clear it (unlike the old global FAB this replaced).
      fabBottomOffset={0}
      testIDPrefix="home"
    />
  );
}
