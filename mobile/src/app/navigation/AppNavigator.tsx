import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { AccountDetailScreen, AddAccountScreen } from '@/features/accounts';
import { BudgetDetailScreen } from '@/features/budgets';
import { CategoryListScreen } from '@/features/categories';
import { TransactionsScreen } from '@/features/transactions';
import { GoalDetailScreen } from '@/features/goals';
import { InviteMemberScreen, WalletActivityScreen, WalletDetailScreen, WalletListScreen, WalletMembersScreen } from '@/features/wallets';
import { ModalProvider } from '../providers/ModalProvider.tsx';
import { MainTabNavigator } from './MainTabNavigator.tsx';
import type { AppStackParamList } from './types.ts';

const Stack = createStackNavigator<AppStackParamList>();

const transparentModalOptions = {
  headerShown: false,
  presentation: 'transparentModal' as const,
  detachPreviousScreen: false,
  cardStyle: { backgroundColor: 'transparent' },
};

/**
 * Uses JS Stack Navigator (@react-navigation/stack) so transparentModal routes
 * do not detach or hide the underlying main tab screen in the DOM.
 */
export function AppNavigator() {
  const { t } = useTranslation();

  return (
    <ModalProvider>
      <Stack.Navigator>
      <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />

      <Stack.Screen name="WalletList" component={WalletListScreen} options={{ title: t('wallets.title') }} />
      <Stack.Screen name="WalletDetail" component={WalletDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="WalletMembers" component={WalletMembersScreen} options={{ title: t('wallets.members') }} />
      <Stack.Screen name="InviteMember" component={InviteMemberScreen} options={{ title: t('members.invite') }} />
      <Stack.Screen name="WalletActivity" component={WalletActivityScreen} options={{ title: t('activity.title') }} />

      <Stack.Screen name="AccountDetail" component={AccountDetailScreen} options={{ title: t('accounts.detailTitle') }} />
      <Stack.Screen name="AddAccount" component={AddAccountScreen} options={transparentModalOptions} />

      <Stack.Screen name="CategoryList" component={CategoryListScreen} options={{ title: t('categories.title') }} />

      <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: t('transactions.title') }} />

      <Stack.Screen name="BudgetDetail" component={BudgetDetailScreen} options={{ title: t('budgets.detailTitle') }} />

      <Stack.Screen name="GoalDetail" component={GoalDetailScreen} options={{ title: t('goals.detailTitle') }} />
    </Stack.Navigator>
    </ModalProvider>
  );
}
