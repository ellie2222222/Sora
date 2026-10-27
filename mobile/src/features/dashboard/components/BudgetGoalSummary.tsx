import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { BudgetResponse, GoalResponse, MoneyString } from '@sora/contracts';

import { Card, Money, ProgressBar, SectionLabel, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { formatMoneyString } from '@/utils';

const PREVIEW_LIMIT = 3;

export interface BudgetGoalSummaryProps {
  budgets: BudgetResponse[];
  goals: GoalResponse[];
  onOpenBudget: (budgetId: string) => void;
  onOpenGoal: (goalId: string) => void;
}

/**
 * The active budgets and goals the dashboard response already carries.
 *
 * A preview, not the Planning tab: capped at a few rows each and tapping
 * through to the real detail screen, so the dashboard answers "am I on track"
 * without turning into a second list screen.
 */
export function BudgetGoalSummary({ budgets, goals, onOpenBudget, onOpenGoal }: BudgetGoalSummaryProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  if (budgets.length === 0 && goals.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {budgets.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <SectionLabel>{t('dashboard.activeBudgets')}</SectionLabel>
          {budgets.slice(0, PREVIEW_LIMIT).map((budget) => (
            <Pressable
              key={budget.id}
              testID={`dashboard-budget-${budget.id}`}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.budgetRowA11y', {
                name: budget.name,
                spent: formatMoneyString(budget.spent, budget.currency),
                amount: formatMoneyString(budget.amount, budget.currency),
                percentage: budget.usagePercentage.toFixed(0),
              })}
              onPress={() => onOpenBudget(budget.id)}
            >
              <Card>
                <View className="flex-row items-center justify-between" style={{ marginBottom: theme.spacing.xs }}>
                  <Text weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {budget.name}
                  </Text>
                  <Text variant="caption" tone={budget.isOverBudget ? 'danger' : 'muted'}>
                    {budget.usagePercentage.toFixed(0)}%
                  </Text>
                </View>
                <ProgressBar percentage={budget.usagePercentage} danger={budget.isOverBudget} />
                <View className="flex-row justify-between" style={{ marginTop: theme.spacing.xs }}>
                  <LabelledFigure label={t('budgets.spent')} amount={budget.spent} currency={budget.currency} />
                  <LabelledFigure label={t('dashboard.budgetLimit')} amount={budget.amount} currency={budget.currency} />
                </View>
              </Card>
            </Pressable>
          ))}
          {budgets.length > PREVIEW_LIMIT ? (
            <Text variant="caption" tone="muted">
              {t('dashboard.andMore', { count: budgets.length - PREVIEW_LIMIT })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {goals.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <SectionLabel>{t('dashboard.activeGoals')}</SectionLabel>
          {goals.slice(0, PREVIEW_LIMIT).map((goal) => (
            <Pressable
              key={goal.id}
              testID={`dashboard-goal-${goal.id}`}
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.goalRowA11y', {
                name: goal.name,
                current: formatMoneyString(goal.currentAmount, goal.currency),
                target: formatMoneyString(goal.targetAmount, goal.currency),
                percentage: goal.progressPercentage.toFixed(0),
              })}
              onPress={() => onOpenGoal(goal.id)}
            >
              <Card>
                <View className="flex-row items-center justify-between" style={{ marginBottom: theme.spacing.xs }}>
                  <Text weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {goal.name}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {t('common.percent', { percent: goal.progressPercentage.toFixed(0) })}
                  </Text>
                </View>
                <ProgressBar percentage={goal.progressPercentage} tone="income" />
                <View className="flex-row justify-between" style={{ marginTop: theme.spacing.xs }}>
                  <LabelledFigure label={t('dashboard.goalSaved')} amount={goal.currentAmount} currency={goal.currency} />
                  <LabelledFigure label={t('goals.target')} amount={goal.targetAmount} currency={goal.currency} />
                </View>
              </Card>
            </Pressable>
          ))}
          {goals.length > PREVIEW_LIMIT ? (
            <Text variant="caption" tone="muted">
              {t('dashboard.andMore', { count: goals.length - PREVIEW_LIMIT })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function LabelledFigure({ label, amount, currency }: { label: string; amount: MoneyString; currency: string }) {
  const theme = useTheme();
  return (
    <Text variant="caption" tone="muted">
      {label} <Money amount={amount} currency={currency} variant="caption" style={{ color: theme.colors.text }} />
    </Text>
  );
}
