import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  AcceptInvitation: { token: string } | undefined;
};

export type MainTabParamList = {
  /** Opens the list narrowed to one account or category, switching to its wallet first when that is not the active one. */
  Home: { walletId: string; accountId?: string; categoryId?: string } | undefined;
  Planning: undefined;
  Ai: undefined;
  Dashboard: undefined;
  Settings: undefined;
};

/**
 * Screens reachable from anywhere in the signed-in app, layered over the tab
 * bar. Kept in one root stack rather than nested per tab, since more than one tab opens them.
 */
export type AppStackParamList = {
  // Typed with NavigatorScreenParams so a caller can deep-link straight into a tab
  // instead of only ever landing on whichever tab was last active.
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  AddAccount: { walletId?: string } | undefined;
  CategoryList: { walletId?: string } | undefined;


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
