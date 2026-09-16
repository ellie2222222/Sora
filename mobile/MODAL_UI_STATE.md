# Mobile Modal UI & Form State Audit

> **Comprehensive UI/UX Audit** of every Create and Update modal in the Sora mobile application. Covers styling architecture, field types, select mechanisms, input behaviors, existing good UX patterns, and actionable recommendations for date pickers and multiselect controls.
>
> **2026-09-16 update:** the four date-handling/duplication findings this audit flagged as open
> (`AddBudgetModal` Weekly/Custom window, `AddContributionModal` hardcoded date, `AddGoalModal` raw
> text date, `AddTransactionModal` duplicate `AccountPicker`) have since been fixed, per a
> from-source-of-truth review — see `verifications/2026-09-16-modal-form-consistency-review.md`. The
> currency-picker and multi-category-budget suggestions were reviewed and deliberately **not**
> implemented (no domain/schema support). Left as historical record below rather than rewritten.

---

## 1. Executive Summary & Inventory Matrix

The Sora mobile app uses a unified modal paradigm anchored by [`BottomSheetModal`](file:///d:/Code/sora/mobile/src/components/BottomSheetModal.tsx). Modals are launched either globally through [`ModalProvider`](file:///d:/Code/sora/mobile/src/app/providers/ModalProvider.tsx) or locally within screen contexts.

| Modal | Type | Trigger / Context | Input Fields | Select Mechanisms | Date Handling | Multiselect Capable? |
|---|---|---|---|---|---|---|
| **AddTransactionModal** | Create | Global `ModalProvider`, Home FAB, Transactions Screen | Amount (`MoneyInput` — calculator keypad), Note (`text`) | Type (Pill Buttons: Expense, Income, Transfer), Account (`AccountPicker`), Category (`CategoryPicker`) | ✅ **`DateField`** → `DatePickerModal`; backdating already works | No (single account/category) |
| **EditTransactionModal** | Update | Global `ModalProvider`, Transaction Detail Screen | Note (`text`), Reference (`text`) | Category (`CategoryPicker`) | ✅ **`DateField`** → `DatePickerModal`; no longer raw regex text | No |
| **AddAccountModal** | Create | Global `ModalProvider`, Wallet Detail, Accounts Screen | Name (`text`), Currency (`text`, 3 chars uppercase), Opening Balance (`MoneyInput` — calculator keypad, signed) | Account Type (Pill Buttons: 4 types) | N/A (implicit creation date) | No |
| **AddBudgetModal** | Create | Global `ModalProvider`, Budgets Screen | Name (`text`), Amount (`MoneyInput` — calculator keypad) | Category (`CategoryPicker` - expense only), Period Type (Pill Buttons: Weekly, Monthly, Custom) | ❌ **Hardcoded**; Custom *and* Weekly both silently get a 1-month range (see §5.4) | 💡 **High Value**: Multi-category budgets |
| **AddGoalModal** | Create | Global `ModalProvider`, Goals Screen | Name (`text`), Target Amount (`MoneyInput` — calculator keypad), Target Date (`text`) | None (uses active wallet currency) | ❌ **Raw Text Input** (`YYYY-MM-DD`); no calendar | No |
| **AddContributionModal** | Create | Global `ModalProvider`, Goal Detail Screen | Amount (`MoneyInput` — calculator keypad), Note (`text`, optional) | Account (`AccountPicker`), Category (`CategoryPicker`, conditional) | ⚠️ **Hardcoded** (`nowInstant()`); cannot backdate | No |
| **CreateCategoryModal** | Create | `CategoryListScreen` Header Action | Name (`text`) | Type (Pill Buttons: Expense, Income) | N/A | No |
| **CategoryRenameDialog** | Update | `CategoryListScreen` (inside `CategoryDeleteDialog`) | Name (`text`) | None | N/A | No |
| **CreateWalletModal** | Create | `WalletListScreen` Header Action | Name (`text`) | None | N/A | No |

---

## 2. Core Styling & Design System Architecture

All create and update modals adhere to Sora's design tokens defined in [`design-system/`](file:///d:/Code/sora/mobile/src/design-system/):

### Base Sheet Container (`BottomSheetModal`)
- **Backdrop**: Black `#000000` with 0 to 0.6 animated opacity fade (`backdropOpacityAnim`, duration: 200ms). Tap dismissible.
- **Surface Elevation**: Grounded with `theme.colors.surface` (e.g. `#16181D` in Obsidian theme, `#FFFFFF` in Light themes).
- **Top Corners**: Rounded with `theme.radius.xl` (20px). Zero bottom gap via a 100px bottom extension skirt.
- **Drag Handle**: Centered pill indicator (36px width, 4px height, `theme.radius.pill`, background `theme.colors.border`).
- **Interactive Gestures**: Smooth PanResponder downward swipe-to-dismiss gesture (triggers dismiss when dragged down >100px or flicked at velocity >1.2).
- **Physics**: Slide-up animation using `Animated.spring` with `tension: 75, friction: 9` for a responsive, organic feel.
- **Keyboard Handling**: Embedded `KeyboardAvoidingView` (`Platform.OS === 'ios' ? 'padding' : undefined`) prevents virtual keyboards from obscuring inputs.

### Layout Spacing & Rhythm
- **Internal Form ScrollView**:
  - `contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}` (16px vertical gap between form rows, 24px bottom buffer).
  - `keyboardShouldPersistTaps="handled"`.
  - `showsVerticalScrollIndicator={false}`.
- **Header Structure**:
  - Optional title rendered with `variant="title"` (`fontSize: 18px`, `fontWeight: 'bold'`, color `theme.colors.text`).

---

## 3. Form Input Types & Behaviors

All text-based form inputs utilize the unified [`Input`](file:///d:/Code/sora/mobile/src/components/Input.tsx) component.

```
┌─────────────────────────────────────────────────────────────┐
│ Label (variant="label", tone="muted", fontSize: 13)         │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Value / Placeholder (height: 48, radius: 8, bg: surface)│ │  <- Focus: 1.5px primary border
│ └─────────────────────────────────────────────────────────┘ │  <- Error: 1.5px danger border
│ Caption / Error message (tone="danger", fontSize: 12)       │
└─────────────────────────────────────────────────────────────┘
```

### Input Field Configurations

1. **Monetary Amounts (`MoneyInput` — calculator-keypad field, not the native keyboard)**:
   - **Used in**: `AddTransactionModal`, `AddBudgetModal`, `AddGoalModal`, `AddContributionModal`, `AddAccountModal` (Opening balance, signed), `BudgetDetailScreen`.
   - **Architecture**: [`MoneyInput.tsx`](file:///d:/Code/sora/mobile/src/components/MoneyInput.tsx) is a real `TextInput` with `showSoftInputOnFocus={false}` — the OS keyboard never appears. On focus it docks a [`CalculatorKeypad`](file:///d:/Code/sora/mobile/src/components/CalculatorKeypad.tsx) (`+ − × ÷ ^`, parentheses, live per-keystroke evaluation) at the bottom of the nearest [`KeyboardDockProvider`](file:///d:/Code/sora/mobile/src/components/KeyboardDockProvider.tsx) (a `BottomSheetModal` or a plain screen), mimicking the slot a native keyboard would occupy.
   - **Formatting**: `formatCurrencyInput`/`formatMoneyCompact` from `@sora/contracts`; math runs on bigint-scaled values (`calculatorEngine.ts`), never a JS number.
   - **Border & Focus**: Same visual language as before — `1px theme.colors.border` → `1.5px theme.colors.primary` on focus, `1.5px theme.colors.danger` when invalid.

2. **Restricted Text / Codes (`maxLength={3}`, `autoCapitalize="characters"`)**:
   - **Used in**: `AddAccountModal` (Currency code: VND, USD, EUR).

3. **Standard Text (`keyboardType="default"`)**:
   - **Used in**: Notes, names, descriptions, references.
   - **Attributes**: `placeholderTextColor={theme.colors.textFaint}`, `color={theme.colors.text}`, `fontSize: 15px`.

4. **Date String Inputs (Current State: ⚠️ Mixed)**:
   - **Fixed**: `EditTransactionModal` and `AddTransactionModal` now use [`DateField`](file:///d:/Code/sora/mobile/src/components/DateField.tsx), a tap-to-open trigger backed by `DatePickerModal` — no more regex.
   - **Still raw text**: `AddGoalModal` (`targetDate`) — plain text with `placeholder="YYYY-MM-DD"`, no validation shown until submit.

---

## 4. Selection Controls & Pickers

Form choices are handled through three standardized patterns:

### A. Segmented Button Pills (Fixed Options $\le$ 4)
- **Used in**:
  - `AddTransactionModal`: Expense / Income / Transfer
  - `AddAccountModal`: Bank account / Cash / E-wallet / Credit card
  - `AddBudgetModal`: Weekly / Monthly / Custom
  - `CreateCategoryModal`: Expense / Income
- **Styling**: Horizontal row (`flexDirection: 'row', gap: theme.spacing.xs`).
  - Active button: `variant="primary"` (solid fill `theme.colors.primary`, text `theme.colors.onPrimary`).
  - Inactive buttons: `variant="secondary"` (bordered surface `theme.colors.surfaceMuted`, text `theme.colors.text`).
- **Interaction**: Single-touch instant toggle; seamlessly triggers conditional form sections (e.g. switching between single-account and dual-account transfer layouts).

### B. Slide-up Modal Selectors (`AccountPicker` & `CategoryPicker`)
- **Trigger Element**:
  - 48px height touch target styled identically to an `Input` field (`borderWidth: 1`, `borderColor: theme.colors.border`, `borderRadius: theme.radius.md`).
  - Left content: Selected item label with contextual indicator (account type icon or category color dot).
  - Right content: Lucide `ChevronDown` (18px, `theme.colors.textMuted`).
- **Modal Content**:
  - Nested `BottomSheetModal` with fixed `maxHeight: 360px` and scrollable item list.
  - Rows render left icon/color pill, primary name, subtitle/wallet badge, right balance/amount, and a checkmark (`Check` icon) on the active selection.
  - Selected row receives `backgroundColor: theme.colors.primaryMuted`.

### C. Full Calendar Date Picker (`DatePickerModal`)
- **Architecture**: Nested `BottomSheetModal` containing a full month/year calendar engine.
- **Features**:
  - Header: Prev/Next month chevron controls + Year switcher toggle button.
  - Weekday initials dynamically localized via `i18next.language` ( narrow UTC formatting ).
  - 7x6 month grid: Null cells padded; past/future days handled; current day highlighted with outline; selected day highlighted with solid `theme.colors.primary` circle.
  - Year grid: Scrollable multi-column year selector covering 90 years (current year - 60 to + 30).
  - Quick action footer: "Today" button resets instantly to current date; "Cancel" dismisses without mutating.
- **Current State**: Wired in via `DateField` for `AddTransactionModal` and `EditTransactionModal`. Still **not wired in** for `AddGoalModal` (target date) or `AddContributionModal` (contribution date, currently hardcoded to today).

---

## 5. Detailed Modal-by-Modal Analysis

### 1. `AddTransactionModal`
- **Location**: [`mobile/src/features/transactions/components/AddTransactionModal.tsx`](file:///d:/Code/sora/mobile/src/features/transactions/components/AddTransactionModal.tsx)
- **Primary Purpose**: Record new financial entries (Expense, Income, or Account Transfer).
- **Component Breakdown**:
  1. *Type Selector*: 3 pill buttons (Expense, Income, Transfer).
  2. *Amount*: `MoneyInput` (calculator keypad).
  3. *Date*: `DateField` → `DatePickerModal`.
  4. *Account Field(s)*:
     - For Expense/Income: Single `AccountPicker` labeled "Account".
     - For Transfer: Dual `AccountPicker` components ("From" and "To").
  5. *Cross-Wallet Banner*: Conditionally displayed if `draft.type === TRANSFER` and destination wallet differs from source wallet.
  6. *Category Field*: Single `CategoryPicker`, reactive to type (filtered to Income or Expense categories). Hidden on Transfer.
  7. *Note*: Text `Input`.
  8. *Submit*: Primary `Button` ("Save").
- **UX Strengths**:
  - **Account Auto-Defaulting**: Automatically selects the first account if none is picked, saving user interaction.
  - **Stateful Type Switching**: `switchType()` preserves accounts and amounts intelligently when swapping between Expense and Income.
  - **Cross-Wallet Warning**: Prominent warning callout prevents accidental transfers across distinct ledgers.
  - **Permission Gate**: Non-writers receive an explanatory view-only message instead of non-functional controls.
  - **Backdating already works**: date picker means logging an earlier receipt no longer requires save-then-edit.
- **UX Opportunities**:
  - ⚠️ **Currency Selector**: Defaults to `'VND'` with no override option for foreign currency accounts.
- **Code-quality note (not user-facing, but relevant to "tedious to adjust")**: the Expense/Income single-account block ([AddTransactionModal.tsx:132-152](file:///d:/Code/sora/mobile/src/features/transactions/components/AddTransactionModal.tsx#L132-L152)) renders two near-identical `AccountPicker` JSX blocks gated on `fields.fromAccount`/`fields.toAccount`, but `fieldsForType` never sets both true at once for these two types — only one ever renders. Both are bound to the same `primaryAccount` value and `setPrimaryAccount` handler. Collapsing to one `{(fields.fromAccount || fields.toAccount) ? <AccountPicker .../> : null}` block would remove ~10 duplicate lines and one place to accidentally edit only one copy of.

---

### 2. `EditTransactionModal`
- **Location**: [`mobile/src/features/transactions/components/EditTransactionModal.tsx`](file:///d:/Code/sora/mobile/src/features/transactions/components/EditTransactionModal.tsx)
- **Primary Purpose**: Update metadata of existing transactions per financial ledger rules.
- **Component Breakdown**:
  1. *Notice Banner*: Explains ledger immutability (amount, type, and accounts are locked per rule BR-03).
  2. *Note*: Text `Input`.
  3. *Date*: `DateField` → `DatePickerModal`.
  4. *Category*: Single `CategoryPicker` (hidden for transfers).
  5. *Reference*: Text `Input`.
  6. *Submit*: Primary `Button` ("Save").
- **UX Strengths**:
  - **Clear Immutability Communication**: Tells the user why certain fields are locked rather than disabling them silently.
  - **Clean Diffing**: Only changed fields are dispatched in `UpdateTransactionRequest`.
  - **Cancelled State Guard**: Immediately disables editing if the transaction has been cancelled.
  - **Fixed since the last pass**: date entry is now a tap-to-open calendar (`DateField`), not a regex-validated text field — no more mistyped `YYYY-MM-DD`.

---

### 3. `AddAccountModal`
- **Location**: [`mobile/src/features/accounts/components/AddAccountModal.tsx`](file:///d:/Code/sora/mobile/src/features/accounts/components/AddAccountModal.tsx)
- **Primary Purpose**: Provision a new financial account within a wallet.
- **Component Breakdown**:
  1. *Name*: Text `Input`, placeholder `"e.g. Vietcombank VND"`.
  2. *Type*: Pill button wrap (Bank account, Cash, E-wallet, Credit card).
  3. *Currency*: Uppercase 3-letter text `Input`.
  4. *Opening Balance*: `MoneyInput` (calculator keypad, negative sign supported for credit-card liabilities).
  5. *Submit*: Primary `Button` ("Add Account").
- **UX Strengths**:
  - **Context-Sensitive Balance Label**: Changes label to `"Opening balance (negative if you owe)"` when `type === CREDIT_CARD`.
  - **Auto-Capitalization**: Currency field automatically forces uppercase text.
- **UX Opportunities**:
  - ⚠️ **Currency Code Typos**: Allowing unvalidated freeform 3-letter codes risks input errors (e.g. "VNN" or "usd"). A quick currency select sheet with common currencies would be much safer.

---

### 4. `AddBudgetModal`
- **Location**: [`mobile/src/features/budgets/components/AddBudgetModal.tsx`](file:///d:/Code/sora/mobile/src/features/budgets/components/AddBudgetModal.tsx)
- **Primary Purpose**: Define spending caps for specific categories over time.
- **Component Breakdown**:
  1. *Name*: Text `Input` (optional, auto-generated if omitted).
  2. *Category*: Single `CategoryPicker` (Expense categories only).
  3. *Amount*: `MoneyInput` (calculator keypad).
  4. *Period*: Pill buttons (Weekly, Monthly, Custom).
  5. *Submit*: Primary `Button` ("New Budget").
- **UX Strengths**:
  - **Smart Name Default**: If user leaves name empty, it automatically defaults to `"{Period} budget"`.
  - **Context Filter**: Pre-filters category list to `type="EXPENSE"`.
- **UX Flaws & Multiselect/Date Opportunities**:
  - ❌ **Critical Custom Date Deficit — confirmed still present, and broader than it looks**: [AddBudgetModal.tsx:66-67](file:///d:/Code/sora/mobile/src/features/budgets/components/AddBudgetModal.tsx#L66-L67) computes `startDate = startOfMonth(today())` and `endDate = periodType === 'MONTHLY' ? endOfMonth(today()) : addMonths(startDate, 1)` — the `else` branch fires for **both** `WEEKLY` and `CUSTOM`, so picking "Weekly" silently creates a one-*month* budget window, and "Custom" has no date inputs at all to override it. No date inputs appear for either.
  - 💡 **Multiselect Opportunity**: Budgets are currently locked to a single category (`categoryId: string`). Users routinely budget across category groups (e.g. "Food" combining Groceries + Dining Out + Coffee). A multiselect category picker would provide massive utility.

---

### 5. `AddGoalModal`
- **Location**: [`mobile/src/features/goals/components/AddGoalModal.tsx`](file:///d:/Code/sora/mobile/src/features/goals/components/AddGoalModal.tsx)
- **Primary Purpose**: Create target-based savings milestones.
- **Component Breakdown**:
  1. *Name*: Text `Input`.
  2. *Target Amount*: `MoneyInput` (calculator keypad).
  3. *Target Date*: Text `Input` (`placeholder="YYYY-MM-DD"`) — **confirmed still raw text, not yet migrated to `DateField`**.
  4. *Submit*: Primary `Button` ("New Goal").
- **UX Strengths**:
  - Clean, concise layout; defaults target currency to wallet base currency.
- **UX Flaws & Fixes**:
  - ❌ **Manual Date Typing**: Target date requires typing `"YYYY-MM-DD"` strings into a text input.
  - 💡 **Solution**: Tapping the date field should open `DatePickerModal` with quick forward chips ("3 Months", "6 Months", "1 Year", "End of Year").

---

### 6. `AddContributionModal`
- **Location**: [`mobile/src/features/goals/components/AddContributionModal.tsx`](file:///d:/Code/sora/mobile/src/features/goals/components/AddContributionModal.tsx)
- **Primary Purpose**: Deposit funds toward a savings goal, either purely virtually or linked to an actual account transaction.
- **Component Breakdown**:
  1. *Amount*: `MoneyInput` (calculator keypad).
  2. *From Account*: `AccountPicker`.
  3. *Record As Expense Checkbox*: Custom Pressable toggle box with Lucide `Check` icon and detailed explanatory helper text.
  4. *Category*: Conditionally rendered `CategoryPicker` (only visible when "Record as expense" is checked).
  5. *Note*: Text `Input`.
  6. *Submit*: Primary `Button` ("Add Contribution").
- **UX Strengths**:
  - **Exceptional Progressive Disclosure**: Explanatory toggle clarifying ledger mechanics ("Moves money out of account now" vs "Mark progress without recording transaction").
  - Category field dynamically appears only when an actual transaction will be recorded.
- **UX Opportunities**:
  - ⚠️ **Missing Date Picker**: Contribution date hardcodes `nowInstant()`. Cannot record past contributions.

---

### 7. Category & Wallet Modals
- **`CreateCategoryModal`** ([`CategoryListScreen.tsx`](file:///d:/Code/sora/mobile/src/features/categories/screens/CategoryListScreen.tsx)):
  - Fast name input + Expense/Income pill buttons.
  - *Opportunity*: Lacks color swatch selector and icon picker (schemas support `color` and `icon`, but defaults to gray).
- **`CategoryRenameDialog`** ([`CategoryListScreen.tsx`](file:///d:/Code/sora/mobile/src/features/categories/screens/CategoryListScreen.tsx)):
  - Embedded inside delete dialog when transactions are linked. Clean rename mode with Cancel and Save buttons.
- **`CreateWalletModal`** ([`WalletListScreen.tsx`](file:///d:/Code/sora/mobile/src/features/wallets/screens/WalletListScreen.tsx)):
  - Simple single-input modal for naming a new shared or personal wallet.

---

## 6. Recommendations for Date Pickers & Multiselect

### A. DatePicker Integration Roadmap
The mobile app already contains a polished, theme-compliant calendar in [`DatePickerModal.tsx`](file:///d:/Code/sora/mobile/src/components/DatePickerModal.tsx). It should be connected across all transaction and planning forms:

```
┌─────────────────────────────────────────────────────────────┐
│ Date                                                        │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📅  Sep 14, 2026                             [ Change ] │ │  -> Opens DatePickerModal
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

1. ✅ **`EditTransactionModal` & `AddTransactionModal`** — done, both use `DateField` → `DatePickerModal` already.
2. **`AddGoalModal`** — still open. Replace raw `<Input placeholder="YYYY-MM-DD" />` with `DateField` directly (it already exists and both transaction modals prove the pattern out — this should be close to a drop-in swap, not new work).
3. **`AddContributionModal`** — still open. Add a `DateField` row (defaults to "Today") so past contributions can be backdated.
4. **`AddBudgetModal` (Weekly & Custom)** — still open, and worse than originally scoped: the `WEEKLY` branch shares the same `addMonths(startDate, 1)` fallback as `CUSTOM` (confirmed at [AddBudgetModal.tsx:66-67](file:///d:/Code/sora/mobile/src/features/budgets/components/AddBudgetModal.tsx#L66-L67)), so "Weekly" doesn't actually create a week-long window either. Needs: a real weekly calculation (`addDays(startDate, 7)`, not `addMonths`), plus dual `DateField`s (Start/End) for `CUSTOM`, with `endDate > startDate` validation.

### B. Multiselect Integration Roadmap
Multiselect is currently absent across all modals (everything is strictly single-select). The following high-value areas will significantly elevate UX:

```
┌─────────────────────────────────────────────────────────────┐
│ Categories (3 selected)                                     │
├─────────────────────────────────────────────────────────────┤
│ [🟢 Groceries ✕]  [🟡 Restaurants ✕]  [☕ Coffee ✕]  [+ Add]│
└─────────────────────────────────────────────────────────────┘
```

1. **Multi-Category Budgeting (`AddBudgetModal`)**:
   - *Problem*: Users cannot create a master "Food & Dining" budget without creating 3 separate budgets.
   - *Design*: Transform `CategoryPicker` into a multi-select chip list with checkbox items in the sheet.
2. **Batch Transaction Filtering (`TransactionListScreen`)**:
   - Filter transactions across multiple selected categories or multiple accounts simultaneously.
3. **Multi-Account Net Worth Reports**:
   - Select multiple accounts for consolidated trend analysis.

---

## 7. Summary of UX Strengths & Action Items

### Key UX Strengths
- Consistent slide-up presentation via `BottomSheetModal`.
- Calculator-keypad money entry (`MoneyInput`) on every amount field, native keyboard fully suppressed.
- Tap-to-open calendar (`DateField`) already wired into `AddTransactionModal` and `EditTransactionModal`.
- First-item auto-selection in account and category pickers.
- Clear upfront notices on immutable fields and cross-wallet interactions.
- Accessible touch targets (48px minimum height).

### Immediate Action Items — status as of 2026-09-16
1. ✅ **Connect `DatePickerModal`** in `EditTransactionModal` and `AddTransactionModal` — done.
   ⬜ Still open for `AddGoalModal` (target date).
2. ⬜ **Support Custom *and* Weekly Budget Ranges**: `AddBudgetModal` needs a real weekly calc (not `addMonths`) plus start/end date pickers for `CUSTOM`.
3. ⬜ **Allow Backdating in `AddContributionModal`** — `AddTransactionModal` already has this via its `DateField`.
4. ⬜ **Currency Select Dropdown**: Replace raw 3-letter currency text input in `AddAccountModal` with a standardized currency picker.
5. ⬜ **Multi-Category Selection**: Support selecting multiple categories for budget creation.
6. ⬜ **Collapse duplicate `AccountPicker` blocks** in `AddTransactionModal` (§5.1) — both bound to the same `primaryAccount`/`setPrimaryAccount`, only one ever renders; one conditional block instead of two.
