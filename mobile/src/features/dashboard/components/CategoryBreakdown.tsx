import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react-native';
import type { CategorySpendSlice, CurrencyTotal } from '@sora/contracts';

import { DonutChart, Money, SectionLabel, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { formatMoneyString, groupByTopLevel, rankCategories, type CategoryNode, type RankedCategory } from '@/utils';

const TOP_CATEGORY_LIMIT = 5;

export interface CategoryBreakdownProps {
  slices: CategorySpendSlice[];
  /** The comparison period's slices, for the change-vs-previous indicator. */
  previousSlices: CategorySpendSlice[];
  expenseTotal: CurrencyTotal | undefined;
  /** Category names by id, so a parent that recorded no direct spending still gets a header. */
  categories: readonly CategoryNode[];
  onSelectCategory?: (categoryId: string) => void;
}

/**
 * The donut plus two readings of the same data: spending rolled up by parent
 * category, and a ranked top-N with each category's change against the previous
 * period.
 *
 * The donut keeps using the flat slices rather than the grouped totals — its
 * arcs are drawn straight from the server's `percentage`, and re-deriving them
 * from a rollup would risk the chart and the legend disagreeing.
 */
export function CategoryBreakdown({
  slices,
  previousSlices,
  expenseTotal,
  categories,
  onSelectCategory,
}: CategoryBreakdownProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Reachable with income but no expense, so the screen is not otherwise empty —
  // a labelled section reads as "nothing to break down", a bare line as a stray
  // sentence between two charts.
  if (slices.length === 0) {
    return (
      <View style={{ gap: theme.spacing.xs }} testID="dashboard-no-spending">
        <SectionLabel>{t('dashboard.topCategories')}</SectionLabel>
        <Text tone="faint">{t('dashboard.noSpendingThisPeriod')}</Text>
      </View>
    );
  }

  const groups = groupByTopLevel(slices, categories);
  const ranked = rankCategories(slices, previousSlices, TOP_CATEGORY_LIMIT);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View className="items-center" style={{ gap: theme.spacing.md }}>
        <DonutChart
          slices={slices}
          centerLabel={
            expenseTotal !== undefined
              ? formatMoneyString(expenseTotal.amount, expenseTotal.currency, { compact: true, hideCurrency: true })
              : undefined
          }
          centerSublabel={t('dashboard.spent')}
        />

        <View className="w-full" style={{ gap: theme.spacing.xs }}>
          {groups.map((group) => (
            <View key={group.id}>
              <Pressable
                testID={`dashboard-category-group-${group.id}`}
                accessibilityRole={group.hasChildren ? 'button' : undefined}
                accessibilityState={group.hasChildren ? { expanded: expanded === group.id } : undefined}
                disabled={!group.hasChildren}
                onPress={() => setExpanded((current) => (current === group.id ? null : group.id))}
                className="flex-row items-center justify-between"
                style={{ paddingVertical: theme.spacing.xs, minHeight: theme.sizes.touchTarget }}
              >
                <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
                  <View
                    className="rounded-pill"
                    style={{ width: theme.sizes.dot.md, height: theme.sizes.dot.md, backgroundColor: group.color ?? theme.colors.primary }}
                  />
                  {group.hasChildren ? (
                    expanded === group.id ? (
                      <ChevronDown size={theme.iconSize.sm} color={theme.colors.textMuted} />
                    ) : (
                      <ChevronRight size={theme.iconSize.sm} color={theme.colors.textMuted} />
                    )
                  ) : null}
                  <Text>{group.name}</Text>
                </View>
                <Text tone="muted">{group.percentage.toFixed(0)}%</Text>
              </Pressable>

              {group.hasChildren && expanded === group.id
                ? group.slices.map((slice) => (
                    <Pressable
                      key={slice.categoryId}
                      testID={`dashboard-category-child-${slice.categoryId}`}
                      accessibilityRole="button"
                      onPress={() => onSelectCategory?.(slice.categoryId)}
                      className="flex-row items-center justify-between"
                      style={{ paddingVertical: theme.spacing.xxs, paddingLeft: theme.spacing.lg, minHeight: theme.sizes.touchTarget }}
                    >
                      <Text variant="caption" tone="muted">
                        {slice.categoryName}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {slice.percentage.toFixed(0)}%
                      </Text>
                    </Pressable>
                  ))
                : null}
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <SectionLabel>{t('dashboard.topCategories')}</SectionLabel>
        {ranked.map((entry) => (
          <TopCategoryRow
            key={entry.slice.categoryId}
            entry={entry}
            // `CategorySpendSlice` carries no currency of its own: the server
            // scopes the whole breakdown to the period's dominant expense
            // currency (BR-07), which is the one `expenseTotal` reports in.
            currency={expenseTotal?.currency ?? ''}
            onPress={onSelectCategory}
          />
        ))}
      </View>
    </View>
  );
}

function TopCategoryRow({
  entry,
  currency,
  onPress,
}: {
  entry: RankedCategory;
  currency: string;
  onPress?: (categoryId: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { slice, rank, changePercent, isNew } = entry;

  return (
    <Pressable
      testID={`dashboard-top-category-${slice.categoryId}`}
      accessibilityRole="button"
      onPress={() => onPress?.(slice.categoryId)}
      className="flex-row items-center justify-between"
      style={{ paddingVertical: theme.spacing.xs, minHeight: theme.sizes.touchTarget }}
    >
      <View className="flex-row items-center flex-1" style={{ gap: theme.spacing.sm }}>
        <Text variant="caption" tone="muted">
          {rank}
        </Text>
        <View
          className="rounded-pill"
          style={{ width: theme.sizes.dot.md, height: theme.sizes.dot.md, backgroundColor: slice.color ?? theme.colors.primary }}
        />
        <Text numberOfLines={1} style={{ flexShrink: 1 }}>
          {slice.categoryName}
        </Text>
      </View>

      <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
        {changePercent !== null && Math.abs(changePercent) >= 1 ? (
          <View className="flex-row items-center" style={{ gap: theme.spacing.xxs }}>
            {changePercent > 0 ? (
              <TrendingUp size={theme.iconSize.xs} color={theme.colors.expense} />
            ) : (
              <TrendingDown size={theme.iconSize.xs} color={theme.colors.income} />
            )}
            <Text variant="caption" tone={changePercent > 0 ? 'danger' : 'muted'}>
              {Math.abs(changePercent)}%
            </Text>
          </View>
        ) : isNew ? (
          <Text variant="caption" tone="muted">
            {t('dashboard.newThisPeriod')}
          </Text>
        ) : null}
        <Money amount={slice.amount} currency={currency} variant="caption" weight="semibold" />
      </View>
    </Pressable>
  );
}
