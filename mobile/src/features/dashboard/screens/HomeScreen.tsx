import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useModal } from '../../../app/providers/ModalProvider';
import { TransactionListScreen } from '../../transactions/components/TransactionListScreen';
import { TAB_BAR_HEIGHT } from '../../../app/navigation/tabBarMetrics';
import type { MainTabScreenProps } from '../../../app/navigation/types';

export function HomeScreen({ navigation }: MainTabScreenProps<'Home'>) {
  const insets = useSafeAreaInsets();
  const { openModal } = useModal();

  return (
    <TransactionListScreen
      onManage={() => navigation.getParent()?.navigate('WalletList')}
      onAddTransaction={() => openModal('AddTransaction')}
      fabBottomOffset={TAB_BAR_HEIGHT + insets.bottom}
      testIDPrefix="home"
    />
  );
}
