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
  Account: undefined;
  Planning: undefined;
  Dashboard: undefined;
  Settings: undefined;
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
  WalletActivity: { walletId: string };
  AccountDetail: { accountId: string };
  AddAccount: { walletId?: string } | undefined;
  CategoryList: { walletId?: string } | undefined;
  Transactions: { accountId?: string; categoryId?: string } | undefined;
  BudgetDetail: { budgetId: string };
  GoalDetail: { goalId: string };
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
