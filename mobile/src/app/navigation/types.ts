import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  AcceptInvitation: { token: string } | undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Transactions: { accountId?: string; categoryId?: string } | undefined;
  AddTransaction: undefined;
  Budgets: undefined;
  Goals: undefined;
};

/**
 * Screens reachable from anywhere in the signed-in app, layered over the tab
 * bar. Kept in one root stack rather than nested per tab, since a transaction's
 * detail is opened from Home, Transactions AND a budget/goal detail alike.
 */
export type AppStackParamList = {
  // Typed with NavigatorScreenParams so a caller can deep-link straight into a
  // tab (e.g. AccountDetail linking to Transactions filtered by this account)
  // instead of only ever landing on whichever tab was last active.
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  WalletList: undefined;
  WalletDetail: { walletId: string };
  WalletMembers: { walletId: string };
  InviteMember: { walletId: string };
  AccountDetail: { accountId: string };
  AddAccount: { walletId?: string } | undefined;
  CategoryList: { walletId?: string } | undefined;
  TransactionDetail: { transactionId: string };
  BudgetDetail: { budgetId: string };
  AddBudget: undefined;
  GoalDetail: { goalId: string };
  AddGoal: undefined;
  AddContribution: { goalId: string };
  Settings: undefined;
  // EditTransaction is not yet built — see mobile/GAPS.md. Deliberately
  // absent here rather than declared-but-unregistered, so navigating to it
  // is a type error instead of a silent runtime failure.
};

export type AuthStackScreenProps<Screen extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  Screen
>;

export type MainTabScreenProps<Screen extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, Screen>,
  AppStackScreenProps<'Main'>
>;

export type AppStackScreenProps<Screen extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  Screen
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends AppStackParamList {}
  }
}
