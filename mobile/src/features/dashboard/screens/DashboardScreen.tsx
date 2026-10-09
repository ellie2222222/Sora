import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

import {
  AnimatedScreen,
  closeOpenSwipeRow,
  PeriodBar,
  RefreshableScrollView,
  SegmentedControl,
  SegmentedControlSkeleton,
  SlideSwap,
  Text,
} from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { ChevronRight } from 'lucide-react-native';
import { AccountDetailModal, AccountScopePicker, AccountsOverview, AccountsOverviewSkeleton } from '@/features/accounts';
import { NoWalletState, WalletContextBar } from '@/features/wallets';
import { BudgetDetailModal } from '@/features/budgets';
import { GoalDetailModal } from '@/features/goals';
import { dashboardApiSlice } from '@/app/store';
import {
  formatPeriodLabel,
  parseDay,
  shiftAnchor,
  today,
  type CalendarDay,
  type DashboardPeriod,
} from '@/utils';
import type { MainTabScreenProps } from '@/app/navigation';
import { PeriodReport, PeriodReportSkeleton, type ReportSection } from '../components/PeriodReport';
import { YearlyReport } from '../components/YearlyReport';

type DashboardTab = ReportSection | 'accounts';
const TABS: readonly DashboardTab[] = ['overview', 'spending', 'accounts'];

export function DashboardScreen({ navigation }: MainTabScreenProps<'Dashboard'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { activeWalletId, isLoading: walletsLoading, permissions, timeZone } = useWallets();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tab, setTab] = useState<DashboardTab>('overview');
  // Remembered with its wallet: an account belongs to one wallet, so after a switch the scope
  // reads as "all accounts" on that same render, before any query could name the old account.
  const [scope, setScope] = useState<{ walletId: string | null; accountId: string | null }>({ walletId: null, accountId: null });
  const scopeAccountId = scope.walletId === activeWalletId ? scope.accountId : null;
  const setScopeAccountId = (accountId: string | null) => setScope({ walletId: activeWalletId, accountId });
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const [period, setPeriod] = useState<DashboardPeriod>('monthly');
  const [anchor, setAnchor] = useState<CalendarDay>(() => today(timeZone));
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const shiftPeriod = (delta: number) => setAnchor((current) => shiftAnchor(period, current, delta));

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      dispatch(dashboardApiSlice.util.invalidateTags(['Dashboard', 'Account']));
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderReport = (walletId: string, section: ReportSection) => (
    <>
      <AccountScopePicker
        walletId={walletId}
        selectedAccountId={scopeAccountId}
        onSelect={setScopeAccountId}
        testID="picker-dashboard-account"
      />

      {scopeAccountId !== null ? (
        <Pressable
          testID="btn-manage-account"
          accessibilityRole="button"
          onPress={() => setSelectedAccountId(scopeAccountId)}
          hitSlop={theme.sizes.hitSlop.lg}
          className="flex-row items-center self-start"
          style={{ gap: theme.spacing.xs }}
        >
          <ChevronRight size={theme.iconSize.md} color={theme.colors.primary} />
          <Text weight="medium" style={{ color: theme.colors.primary }}>
            {t('dashboard.manageAccount')}
          </Text>
        </Pressable>
      ) : null}

      {/* The year's trend needs each month on its own; its spending breakdown is one query over the whole year. */}
      {section === 'overview' && period === 'yearly' ? (
        <YearlyReport
          key={`${walletId}|${scopeAccountId ?? 'all'}`}
          walletId={walletId}
          accountId={scopeAccountId}
          year={parseDay(anchor).year}
          periodLabel={formatPeriodLabel(period, anchor)}
          onOpenBudget={setSelectedBudgetId}
          onOpenGoal={setSelectedGoalId}
          onPreviousPeriod={() => shiftPeriod(-1)}
        />
      ) : (
        <PeriodReport
          section={section}
          walletId={walletId}
          accountId={scopeAccountId}
          period={period}
          anchor={anchor}
          navigation={navigation}
          onOpenBudget={setSelectedBudgetId}
          onOpenGoal={setSelectedGoalId}
          onPreviousPeriod={() => shiftPeriod(-1)}
        />
      )}
    </>
  );

  return (
    <AnimatedScreen testID="screen-dashboard">
      <WalletContextBar>
        {walletsLoading || activeWalletId !== null ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              gap: theme.spacing.md,
              backgroundColor: theme.colors.background,
            }}
          >
            {walletsLoading ? (
              <SegmentedControlSkeleton count={TABS.length} />
            ) : (
              <SegmentedControl
                options={[
                  { value: 'overview', label: t('dashboard.overviewTab'), testID: 'dashboard-segment-overview' },
                  { value: 'spending', label: t('dashboard.spendingTab'), testID: 'dashboard-segment-spending' },
                  { value: 'accounts', label: t('dashboard.accountsTab'), testID: 'dashboard-segment-accounts' },
                ]}
                value={tab}
                onChange={setTab}
              />
            )}
            {/* Net worth and balances are as of now, whatever period is chosen. */}
            {tab !== 'accounts' ? (
              <PeriodBar period={period} anchor={anchor} onChangePeriod={setPeriod} onShift={shiftPeriod} today={today(timeZone)} />
            ) : null}
          </View>
        ) : null}

        <SlideSwap swapKey={TABS.indexOf(tab)} style={{ flex: 1 }}>
          <RefreshableScrollView
            testID={`dashboard-pane-${tab}`}
            onScrollBeginDrag={closeOpenSwipeRow}
            // flexGrow lets an empty state centre itself in the leftover height; with
            // real content to scroll it has no effect.
            contentContainerStyle={{ flexGrow: 1, padding: theme.spacing.md, paddingBottom: theme.spacing.xxl, gap: theme.spacing.xl }}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
          >
            {walletsLoading ? (
              tab === 'accounts' ? <AccountsOverviewSkeleton /> : <PeriodReportSkeleton section={tab} />
            ) : activeWalletId === null ? (
              <NoWalletState
                title={t('dashboard.noWalletYet')}
                message={t('dashboard.createWalletToSee')}
                testID="dashboard-empty"
                entrance="none"
              />
            ) : tab === 'accounts' ? (
              <AccountsOverview walletId={activeWalletId} canWrite={permissions.canWrite} onOpenAccount={setSelectedAccountId} />
            ) : (
              renderReport(activeWalletId, tab)
            )}
          </RefreshableScrollView>
        </SlideSwap>
      </WalletContextBar>
      <BudgetDetailModal budgetId={selectedBudgetId} onClose={() => setSelectedBudgetId(null)} />
      <GoalDetailModal goalId={selectedGoalId} onClose={() => setSelectedGoalId(null)} />
      <AccountDetailModal
        accountId={selectedAccountId}
        onClose={() => setSelectedAccountId(null)}
        onViewTransactions={(account) => {
          setSelectedAccountId(null);
          navigation.navigate('Home', account);
        }}
      />
    </AnimatedScreen>
  );
}
