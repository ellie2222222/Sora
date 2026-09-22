import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useModal } from '@/app/providers';
import { TransactionListScreen } from '../components/TransactionListScreen';
import type { AppStackScreenProps } from '@/app/navigation';

export function TransactionsScreen({ route, navigation }: AppStackScreenProps<'Transactions'>) {
  const insets = useSafeAreaInsets();
  const { openModal } = useModal();

  return (
    <TransactionListScreen
      accountId={route.params?.accountId}
      categoryId={route.params?.categoryId}
      onManage={() => navigation.navigate('WalletList')}
      onAddTransaction={() => openModal('AddTransaction')}
      fabBottomOffset={insets.bottom}
      testIDPrefix="transactions"
    />
  );
}
