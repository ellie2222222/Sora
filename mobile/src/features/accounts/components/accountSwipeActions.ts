import type { TFunction } from 'i18next';
import { Archive, Pencil } from 'lucide-react-native';

import type { SwipeRowAction } from '@/components';

/** Edit opens the account's own screen, where its edit card lives; Archive asks the caller to confirm. */
export function accountSwipeActions(
  t: TFunction,
  { onOpen, onArchive }: { onOpen: () => void; onArchive: () => void },
): SwipeRowAction[] {
  return [
    { key: 'edit', label: t('common.edit'), icon: Pencil, tone: 'primary', onPress: onOpen, testID: 'btn-edit-account' },
    { key: 'archive', label: t('common.archive'), icon: Archive, tone: 'danger', onPress: onArchive, testID: 'btn-archive-account' },
  ];
}
