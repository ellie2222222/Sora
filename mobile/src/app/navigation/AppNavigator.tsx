import { createStackNavigator } from '@react-navigation/stack';

import { AccountDetailScreen } from '../../features/accounts/screens/AccountDetailScreen.tsx';
import { AddAccountScreen } from '../../features/accounts/screens/AddAccountScreen.tsx';
import { AddBudgetScreen } from '../../features/budgets/screens/AddBudgetScreen.tsx';
import { BudgetDetailScreen } from '../../features/budgets/screens/BudgetDetailScreen.tsx';
import { BudgetsScreen } from '../../features/budgets/screens/BudgetsScreen.tsx';
import { CategoryListScreen } from '../../features/categories/screens/CategoryListScreen.tsx';
import { AddContributionScreen } from '../../features/goals/screens/AddContributionScreen.tsx';
import { AddTransactionScreen } from '../../features/transactions/screens/AddTransactionScreen.tsx';
import { EditTransactionScreen } from '../../features/transactions/screens/EditTransactionScreen.tsx';
import { TransactionsScreen } from '../../features/transactions/screens/TransactionsScreen.tsx';
import { AddGoalScreen } from '../../features/goals/screens/AddGoalScreen.tsx';
import { GoalDetailScreen } from '../../features/goals/screens/GoalDetailScreen.tsx';
import { TransactionDetailScreen } from '../../features/transactions/screens/TransactionDetailScreen.tsx';
import { InviteMemberScreen } from '../../features/wallets/screens/InviteMemberScreen.tsx';
import { WalletActivityScreen } from '../../features/wallets/screens/WalletActivityScreen.tsx';
import { WalletDetailScreen } from '../../features/wallets/screens/WalletDetailScreen.tsx';
import { WalletListScreen } from '../../features/wallets/screens/WalletListScreen.tsx';
import { WalletMembersScreen } from '../../features/wallets/screens/WalletMembersScreen.tsx';
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
 * Main application navigation stack.
 * Uses JS Stack Navigator (@react-navigation/stack) so transparentModal routes
 * do not detach or hide the underlying main tab screen in the DOM.
 */
export function AppNavigator() {
  return (
    <ModalProvider>
      <Stack.Navigator>
      <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />

      <Stack.Screen name="WalletList" component={WalletListScreen} options={{ title: 'Wallets' }} />
      <Stack.Screen name="WalletDetail" component={WalletDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="WalletMembers" component={WalletMembersScreen} options={{ title: 'Members' }} />
      <Stack.Screen name="InviteMember" component={InviteMemberScreen} options={{ title: 'Invite' }} />
      <Stack.Screen name="WalletActivity" component={WalletActivityScreen} options={{ title: 'Activity' }} />

      <Stack.Screen name="AccountDetail" component={AccountDetailScreen} options={{ title: 'Account' }} />
      <Stack.Screen name="AddAccount" component={AddAccountScreen} options={transparentModalOptions} />

      <Stack.Screen name="CategoryList" component={CategoryListScreen} options={{ title: 'Categories' }} />

      <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Transactions' }} />
      <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} options={{ title: 'Transaction' }} />
      <Stack.Screen name="AddTransaction" component={AddTransactionScreen} options={transparentModalOptions} />
      <Stack.Screen name="EditTransaction" component={EditTransactionScreen} options={transparentModalOptions} />

      <Stack.Screen name="Budgets" component={BudgetsScreen} options={{ title: 'Budgets' }} />
      <Stack.Screen name="BudgetDetail" component={BudgetDetailScreen} options={{ title: 'Budget' }} />
      <Stack.Screen name="AddBudget" component={AddBudgetScreen} options={transparentModalOptions} />

      <Stack.Screen name="GoalDetail" component={GoalDetailScreen} options={{ title: 'Goal' }} />
      <Stack.Screen name="AddGoal" component={AddGoalScreen} options={transparentModalOptions} />
      <Stack.Screen name="AddContribution" component={AddContributionScreen} options={transparentModalOptions} />

    </Stack.Navigator>
    </ModalProvider>
  );
}
