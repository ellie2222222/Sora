import type { AccountType } from '@sora/contracts';
import { View } from 'react-native';

import { useTheme } from '@/app/providers';
import { accountTint } from '../accountTint.ts';
import { ACCOUNT_ICON } from './AccountPicker.tsx';

/** The account's type icon on its identity colour, the same on every screen that names the account. */
export function AccountBadge({ accountId, type }: { accountId: string; type: AccountType }) {
  const theme = useTheme();
  const tint = accountTint(accountId, theme.accountTints);
  const Icon = ACCOUNT_ICON[type];
  return (
    <View
      className="items-center justify-center"
      style={{ width: theme.sizes.badge.md, height: theme.sizes.badge.md, borderRadius: theme.radius.pill, backgroundColor: tint.accent }}
    >
      <Icon size={theme.iconSize.md} color={tint.surface} />
    </View>
  );
}
