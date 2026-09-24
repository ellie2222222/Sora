import type { AppStackScreenProps } from '@/app/navigation';
import { AddAccountModal } from '../components/AddAccountModal.tsx';

/** The deep-linkable route form of the add-account sheet; the form itself lives once, in AddAccountModal. */
export function AddAccountScreen({ route, navigation }: AppStackScreenProps<'AddAccount'>) {
  return <AddAccountModal visible walletId={route.params?.walletId} onClose={() => navigation.goBack()} />;
}
