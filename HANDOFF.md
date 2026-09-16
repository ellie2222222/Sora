# Handoff: Mobile Button Invisibility, FAB Positioning Regression & NativeWind Audit

**Date:** 2026-09-14
**Target Audience:** Incoming AI Agent / Engineer
**Workspace:** `d:\Code\sora`

---

## 1. What Happened

### A. The "Disappearing Buttons" & Missing Triggers

1. **Commit `f91fb0f`**: Originally, `mobile/src/app/navigation/MainTabNavigator.tsx` contained a global floating `Fab` button anchored at the bottom center of the screen above the tab bar (`onPress={() => navigation.navigate('AddTransaction')}`).
2. **Commit `cb7394b` (ModalProvider & RTK Query Refactor)**:
   - The global `Fab` was removed from `MainTabNavigator.tsx`.
   - `HomeScreen.tsx` was changed to render `<TransactionListScreen>` with props:
     ```tsx
     <TransactionListScreen
       onManage={() => navigation.getParent()?.navigate('WalletList')}
       onAddTransaction={() => openModal('AddTransaction')}
       fabBottomOffset={TAB_BAR_HEIGHT + insets.bottom}
       testIDPrefix="home"
     />
     ```
   - **Bug / Regression**: `TransactionListScreen.tsx` imported `Fab` and accepted `fabBottomOffset` and `onAddTransaction`, but **never rendered `<Fab>`** anywhere in its JSX. As a result, whenever transactions exist in the wallet, there is **no Add button or FAB anywhere on the screen**.
   - Similarly, in `mobile/src/features/goals/screens/GoalsScreen.tsx` and `mobile/src/features/budgets/screens/BudgetsScreen.tsx`, when items exist (`items.length > 0`), the empty-state action is gone and there is no header button or FAB to create a new goal or budget.
3. **Previous Agent's Flawed Attempt & Bottom Padding Regression**:
   - The prior agent attempted to inject `<Fab bottomOffset={fabBottomOffset} />` directly into `TransactionListScreen.tsx`.
   - Because `HomeScreen` passed `fabBottomOffset = TAB_BAR_HEIGHT + insets.bottom` (~80-100px) and `Fab.tsx` *already* had `bottom: theme.spacing.md + bottomOffset`, the FAB was pushed far up into the content list, causing a noticeable bottom padding regression.
   - The user requested an immediate revert: `mobile/src/components/Button.tsx`, `mobile/src/features/transactions/components/TransactionListScreen.tsx`, `mobile/src/features/goals/screens/GoalsScreen.tsx`, and `mobile/src/features/budgets/screens/BudgetsScreen.tsx` were reverted back to the user's versions.

### B. Why NativeWind Was Configured But Never Used

1. **Audit Evidence (`verifications/2026-09-12-infra-audit.md:46-55`)**:
   - In commit `56688e0`, NativeWind v4 dependencies and config were added: `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `global.css`, and `nativewind-env.d.ts`.
   - However, `grep -rl "className=" mobile/src` returned **0 occurrences across all 77 `.tsx` files**.
   - The entire application was constructed using TypeScript theme tokens (`useTheme()`, `StyleSheet.create()`, and `mobile/src/design-system/colors.ts`).
   - In addition, `mobile/tailwind.config.js` hardcodes independent color values that diverge from `colors.ts`.
   - The previous AI did not use NativeWind because doing so on isolated components without an architectural decision would introduce a split-styling paradigm across the codebase.

### C. Exchange Rate & Enum Tasks (Already Completed)

- `plans/architecture/exchange-rate-resilience-plan.md` has been fully implemented and verified:
  - Migration `db/migrations/003_exchange_rate_snapshots.sql`.
  - Server service with snapshot lookup, cache fallbacks, and resilient `FRESH`/`STALE`/`UNAVAILABLE` status states.
  - Contracts enums and schemas updated to use domain enums (`WALLET_STATUSES`, `ACCOUNT_STATUSES`, etc.).
  - Mobile `DashboardScreen.tsx` and all 10 locale files updated.
  - 11/11 server tests pass, contract parity checks pass.

---

## 2. Current Context

- **Active Workspace**: `d:\Code\sora`
- **Reverted Files (User Clean State)**:
  - `mobile/src/components/Button.tsx`
  - `mobile/src/features/transactions/components/TransactionListScreen.tsx`
  - `mobile/src/features/goals/screens/GoalsScreen.tsx`
  - `mobile/src/features/budgets/screens/BudgetsScreen.tsx`
- **Typecheck & Tests Status**:
  - `npm run typecheck` passes cleanly across all workspaces (`server`, `mobile`, `contracts`).
  - `npm test -w @sora/contracts` and `npm test -w @sora/server` pass.
- **Dev Server**: Metro / Expo server running in the background.

---

## 3. What Needs To Be Done

### Step 1: Fix TransactionListScreen FAB & Bottom Offset

1. In `mobile/src/features/transactions/components/TransactionListScreen.tsx`:
   - Render the `Fab` component when `onAddTransaction` is provided.
   - Make sure `Fab` is positioned properly relative to the screen / safe area:
     - Notice `Fab.tsx` line 26: `bottom: theme.spacing.md + bottomOffset`.
     - In `HomeScreen.tsx`, `fabBottomOffset={TAB_BAR_HEIGHT + insets.bottom}` is passed so that the FAB floats above the bottom navigation bar.
     - Ensure the container of `TransactionListScreen` has `flex: 1` and does not clip absolute children.
     - Ensure the ScrollView has `contentContainerStyle` with bottom padding accounting for the tab bar and FAB (`TAB_BAR_HEIGHT + insets.bottom + 64`), so items at the bottom are not obscured.
   - For `TransactionsScreen.tsx` (the stack screen without a bottom tab bar), check what `fabBottomOffset` is passed (it should only be `insets.bottom`, not `TAB_BAR_HEIGHT + insets.bottom`).

### Step 2: Add / Restore Missing Actions on Other Screens

1. **`GoalsScreen.tsx`**:
   - When `items.length > 0`, provide an entry point to create a goal (e.g. an add icon button `<Plus>` in the header right or in `WalletContextBar`, matching `AccountsScreen.tsx:99-106`).
2. **`BudgetsScreen.tsx`**:
   - When `items.length > 0`, provide an entry point to create a budget (matching `AccountsScreen.tsx` / `WalletContextBar` header action).

### Step 3: Verify Button Contrast & Layout

1. In `mobile/src/components/Button.tsx`:
   - Inspect all variants (`primary`, `secondary`, `danger`, `danger-outline`, `ghost`).
   - Check if any screen renders a `ghost` or `secondary` button against a background where it loses contrast.
   - Ensure `fullWidth` prop behaves properly inside flex column containers.

### Step 4: Resolve NativeWind vs Design System

1. Ask the user or align on whether to:
   - **Option A**: Keep the established `useTheme()` / `StyleSheet` token system for consistency, and cleanly remove NativeWind config/dependencies to eliminate dead config and babel overhead.
   - **Option B (recommended)**: Progressively adopt NativeWind by defining a Tailwind theme preset that directly imports `colors.ts` tokens, then refactoring `Button.tsx` and core components to use `className`.

---

## 4. Definition of Done Checklist

- [ ] **Transaction FAB visible**: On Home tab and Transactions screen, the FAB button is visible when transactions exist.
- [ ] **No FAB padding regression**: The FAB rests cleanly above the bottom tab bar (~16px margin above the tab bar), not floating in the middle of the screen.
- [ ] **Scroll content not clipped**: List items can be scrolled past the tab bar and FAB without being obscured.
- [ ] **Goals & Budgets action triggers**: User can add goals and budgets even when lists are not empty.
- [ ] **No invisible buttons**: All button variants have clear contrast and explicit boundaries in both Light and Dark themes.
- [ ] **NativeWind decision clarified**: Either NativeWind dead config is removed or a clear migration path with token parity is implemented.
- [ ] **All tests & typechecks pass**:
  - `npm run typecheck` across all packages (0 errors).
  - `npm test -w @sora/contracts` passes.
  - `npm test -w @sora/server` passes.
