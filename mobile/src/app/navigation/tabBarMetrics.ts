/**
 * Shared with any tab screen that needs to clear the bottom tab bar for its
 * own absolutely-positioned chrome (the Home FAB) — kept out of
 * `MainTabNavigator.tsx` itself so a screen it renders can import this
 * without a circular import back through the navigator.
 */
export const TAB_BAR_HEIGHT = 56;
