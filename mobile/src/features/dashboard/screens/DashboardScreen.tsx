import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { AnimatedScreen, closeOpenSwipeRow, PeriodBar, RefreshableScrollView, Skeleton, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { ChevronRight } from 'lucide-react-native';
import { AccountsOverview } from '@/features/accounts';
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
import { AccountScopePicker } from '../components/AccountScopePicker';
import { PeriodReport } from '../components/PeriodReport';
import { YearlyReport } from '../components/YearlyReport';

export function DashboardScreen({ navigation }: MainTabScreenProps<'Dashboard'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { activeWalletId, isLoading: walletsLoading, permissions } = useWallets();
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Remembered with its wallet: an account belongs to one wallet, so after a switch the scope
  // reads as "all accounts" on that same render, before any query could name the old account.
  const [scope, setScope] = useState<{ walletId: string | null; accountId: string | null }>({ walletId: null, accountId: null });
  const scopeAccountId = scope.walletId === activeWalletId ? scope.accountId : null;
  const setScopeAccountId = (accountId: string | null) => setScope({ walletId: activeWalletId, accountId });
  const openAccount = (accountId: string) => navigation.getParent()?.navigate('AccountDetail', { accountId });

  const [period, setPeriod] = useState<DashboardPeriod>('monthly');
  const [anchor, setAnchor] = useState<CalendarDay>(() => today());
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

  return (
    <AnimatedScreen>
      <WalletContextBar>
        <RefreshableScrollView
          testID="screen-dashboard"
          onScrollBeginDrag={closeOpenSwipeRow}
          // flexGrow lets an empty state centre itself in the leftover height; with
          // real content to scroll it has no effect.
          contentContainerStyle={{ flexGrow: 1, padding: theme.spacing.md, gap: theme.spacing.lg }}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        >
          <PeriodBar
            period={period}
            anchor={anchor}
            onChangePeriod={setPeriod}
            onShift={shiftPeriod}
          />

          {walletsLoading ? (
                        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xl }}>
              {/* AccountScopePicker + AccountsOverview Mock */}
              <View style={{ gap: theme.spacing.md }}>
                <Skeleton width={140} height={24} radius={theme.radius.sm} />
                <View className="flex-row" style={{ gap: theme.spacing.sm }}>
                  <Skeleton width={100} height={36} radius={18} />
                  <Skeleton width={100} height={36} radius={18} />
                </View>
                <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                  {Array.from({ length: 2 }).map((_, i) => (
                     <View key={i} className="flex-row items-center justify-between">
                       <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
                         <Skeleton width={40} height={40} radius={20} />
                         <View style={{ gap: theme.spacing.xs }}>
                           <Skeleton width={100} height={16} radius={theme.radius.sm} />
                           <Skeleton width={60} height={12} radius={theme.radius.sm} />
                         </View>
                       </View>
                       <Skeleton width={80} height={16} radius={theme.radius.sm} />
                     </View>
                  ))}
                </View>
              </View>

              {/* PeriodReport Mock */}
              <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.md }}>
                <Skeleton width={120} height={20} radius={theme.radius.sm} />
                <Skeleton width="100%" height={200} radius={theme.radius.lg} />
              </View>
            </View>
          ) : activeWalletId === null ? (
            <NoWalletState
              title={t('dashboard.noWalletYet')}
              message={t('dashboard.createWalletToSee')}
              testID="dashboard-empty"
            />
          ) : (
            <>
              <AccountScopePicker
                walletId={activeWalletId}
                selectedAccountId={scopeAccountId}
                onSelect={setScopeAccountId}
              />

              {scopeAccountId === null ? (
                <AccountsOverview
                  walletId={activeWalletId}
                  canWrite={permissions.canWrite}
                  onOpenAccount={openAccount}
                />
              ) : (
                <Pressable
                  testID="btn-manage-account"
                  onPress={() => openAccount(scopeAccountId)}
                  className="flex-row items-center self-start"
                  style={{ gap: theme.spacing.xs }}
                >
                  <ChevronRight size={16} color={theme.colors.primary} />
                  <Text weight="medium" style={{ color: theme.colors.primary }}>
                    {t('dashboard.manageAccount')}
                  </Text>
                </Pressable>
              )}

              {period === 'yearly' ? (
                <YearlyReport
                  key={scopeAccountId ?? 'all'}
                  walletId={activeWalletId}
                  accountId={scopeAccountId}
                  year={parseDay(anchor).year}
                  periodLabel={formatPeriodLabel(period, anchor)}
                  navigation={navigation}
                  onOpenBudget={setSelectedBudgetId}
                  onOpenGoal={setSelectedGoalId}
                  onPreviousPeriod={() => shiftPeriod(-1)}
                />
              ) : (
                <PeriodReport
                  walletId={activeWalletId}
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
          )}
        </RefreshableScrollView>
      </WalletContextBar>
      <BudgetDetailModal budgetId={selectedBudgetId} onClose={() => setSelectedBudgetId(null)} />
      <GoalDetailModal goalId={selectedGoalId} onClose={() => setSelectedGoalId(null)} />
    </AnimatedScreen>
  );
}
