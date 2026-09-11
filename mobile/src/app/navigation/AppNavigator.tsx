import { createNativeStackNavigator } from '@react-navigation/native-stack';

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
import { MainTabNavigator } from './MainTabNavigator.tsx';
import type { AppStackParamList } from './types.ts';

const Stack = createNativeStackNavigator<AppStackParamList>();

/**
 * Everything reachable once signed in. The tab bar is one screen in this
 * stack ("Main") so a detail pushed from any tab still gets a native back
 * gesture/header, rather than nesting a second stack inside every tab.
 */
export function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />

      <Stack.Screen name="WalletList" component={WalletListScreen} options={{ title: 'Wallets' }} />
      <Stack.Screen name="WalletDetail" component={WalletDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="WalletMembers" component={WalletMembersScreen} options={{ title: 'Members' }} />
      <Stack.Screen name="InviteMember" component={InviteMemberScreen} options={{ title: 'Invite' }} />
      <Stack.Screen name="WalletActivity" component={WalletActivityScreen} options={{ title: 'Activity' }} />

      <Stack.Screen name="AccountDetail" component={AccountDetailScreen} options={{ title: 'Account' }} />
      <Stack.Screen name="AddAccount" component={AddAccountScreen} options={{ title: 'Add Account', presentation: 'modal' }} />

      <Stack.Screen name="CategoryList" component={CategoryListScreen} options={{ title: 'Categories' }} />

      <Stack.Screen name="Transactions" component={TransactionsScreen} options={{ title: 'Transactions' }} />
      <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} options={{ title: 'Transaction' }} />
      <Stack.Screen name="AddTransaction" component={AddTransactionScreen} options={{ title: 'Add Transaction', presentation: 'modal' }} />
      <Stack.Screen name="EditTransaction" component={EditTransactionScreen} options={{ title: 'Edit Transaction', presentation: 'modal' }} />

      <Stack.Screen name="Budgets" component={BudgetsScreen} options={{ title: 'Budgets' }} />
      <Stack.Screen name="BudgetDetail" component={BudgetDetailScreen} options={{ title: 'Budget' }} />
      <Stack.Screen name="AddBudget" component={AddBudgetScreen} options={{ title: 'New Budget', presentation: 'modal' }} />

      <Stack.Screen name="GoalDetail" component={GoalDetailScreen} options={{ title: 'Goal' }} />
      <Stack.Screen name="AddGoal" component={AddGoalScreen} options={{ title: 'New Goal', presentation: 'modal' }} />
      <Stack.Screen name="AddContribution" component={AddContributionScreen} options={{ title: 'Add Contribution', presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
