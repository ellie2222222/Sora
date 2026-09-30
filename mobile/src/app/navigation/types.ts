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
  Planning: undefined;
  Ai: undefined;
  Dashboard: undefined;
  Settings: undefined;
};

/**
 * Screens reachable from anywhere in the signed-in app, layered over the tab
 * bar. Kept in one root stack rather than nested per tab, since a budget or goal
 * detail opens from both Planning and Dashboard, and Transactions from more than one tab.
 */
export type AppStackParamList = {
  // Typed with NavigatorScreenParams so a caller can deep-link straight into a tab
  // instead of only ever landing on whichever tab was last active.
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
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
