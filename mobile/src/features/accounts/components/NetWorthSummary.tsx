import { useEffect, useRef } from 'react';
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Money, SectionLabel, Skeleton, Text } from '@/components';
import { useTheme } from '@/app/providers';
import type { Theme } from '@/design-system';
import { formatMoneyString } from '@/utils';
import { headlineSizeFor, splitMoneyText, type CurrencyFigure } from '../netWorth.ts';

const PANEL_ENTERING = FadeIn.duration(240);
const VALUE_CHANGE = FadeIn.duration(180);
/** Wallets whose panel already faded in this session; coming back to the tab doesn't replay it. */
const panelStyle = (theme: Theme) => ({
  gap: theme.spacing.lg,
  padding: theme.spacing.lg,
  borderRadius: theme.radius.xl,
  borderWidth: theme.borderWidth.thin,
  borderColor: theme.colors.border,
  backgroundColor: theme.colors.surface,
});
const entered = new Set<string>();

/** False on the first render, so a figure that merely appears isn't treated as one that changed. */
function useHasMounted(): boolean {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  return mounted.current;
}

/** Headline, then every other currency as its own figure (BR-07: held, never converted or added), then assets vs liabilities. */
export function NetWorthSummary({
  walletId,
  netWorth,
  assets,
  liabilities,
}: {
  walletId: string;
  netWorth: CurrencyFigure[];
  assets: CurrencyFigure[];
  liabilities: CurrencyFigure[];
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const firstEntry = !entered.has(walletId);
  useEffect(() => {
    entered.add(walletId);
  }, [walletId]);

  const [headline, ...others] = netWorth;

  return (
    <Animated.View testID="section-net-worth" entering={firstEntry ? PANEL_ENTERING : undefined} style={panelStyle(theme)}>
      <View style={{ gap: theme.spacing.xs }}>
        <SectionLabel action={headline ? <CurrencyTag currency={headline.currency} /> : undefined}>{t('accounts.netWorth')}</SectionLabel>
        {headline ? <Headline figure={headline} /> : null}
      </View>

      {others.length > 0 ? (
        <View style={{ gap: theme.spacing.xs }} testID="net-worth-other-currencies">
          <Text variant="caption" tone="muted">
            {t('accounts.otherCurrencies')}
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: theme.spacing.sm }}>
            {others.map((figure) => (
              <View
                key={figure.currency}
                className="flex-row items-center"
                style={{
                  gap: theme.spacing.sm,
                  paddingVertical: theme.spacing.xs,
                  paddingHorizontal: theme.spacing.sm,
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.surfaceMuted,
                }}
              >
                <CurrencyTag currency={figure.currency} />
                <Money amount={figure.amount} currency={figure.currency} variant="label" weight="semibold" numberOfLines={1} />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View className="flex-row" style={{ gap: theme.spacing.sm }}>
        <PositionCard
          title={t('accounts.assets')}
          icon={TrendingUp}
          totals={assets}
          accent={theme.colors.income}
          surface={theme.colors.incomeMuted}
          testID="net-worth-assets"
        />
        <PositionCard
          title={t('accounts.liabilities')}
          icon={TrendingDown}
          totals={liabilities}
          accent={theme.colors.expense}
          surface={theme.colors.expenseMuted}
          testID="net-worth-liabilities"
        />
      </View>
    </Animated.View>
  );
}

/** The currency mark sits smaller and muted beside the digits, so "₫"'s built-in bar never reads as an underline. */
function Headline({ figure }: { figure: CurrencyFigure }) {
  const theme = useTheme();
  const hasMounted = useHasMounted();
  const text = formatMoneyString(figure.amount, figure.currency);
  const { sign, prefix, digits, suffix } = splitMoneyText(text);
  const size = theme.fontSize[headlineSizeFor(digits)];
  // Muted text keeps its size floor (DESIGN_GUIDELINES, Type size and tone) however far the headline steps down.
  const markStyle = { fontSize: Math.max(Math.round(size * 0.6), theme.fontSize.sm), color: theme.colors.textMuted };

  return (
    // Keyed on the figure, so a new total fades in once instead of ticking through values it never had.
    <Animated.View key={`${figure.currency}:${figure.amount}`} entering={hasMounted ? VALUE_CHANGE : undefined}>
      <Text numeric weight="bold" accessibilityLabel={text} testID="accounts-net-worth" style={{ fontSize: size, lineHeight: Math.round(size * 1.2) }}>
        {sign}
        {prefix ? <Text style={markStyle}>{prefix}</Text> : null}
        {digits}
        {suffix ? <Text style={markStyle}>{suffix}</Text> : null}
      </Text>
    </Animated.View>
  );
}

/** The ISO code beside a figure, so "$" or "¥" is never left to guesswork. */
function CurrencyTag({ currency }: { currency: string }) {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: theme.spacing.xs, borderRadius: theme.radius.sm, borderWidth: theme.borderWidth.thin, borderColor: theme.colors.borderStrong }}>
      <Text variant="caption" weight="semibold" tone="muted">
        {currency}
      </Text>
    </View>
  );
}

/** Tinted in its semantic colour with an inset bar, and labelled in words so colour is never the only cue. */
function PositionCard({
  title,
  icon: Icon,
  totals,
  accent,
  surface,
  testID,
}: {
  title: string;
  icon: LucideIcon;
  totals: CurrencyFigure[];
  accent: string;
  surface: string;
  testID: string;
}) {
  const theme = useTheme();
  const hasMounted = useHasMounted();
  const [first, ...rest] = totals;

  return (
    <View
      testID={testID}
      className="flex-row"
      style={{ flex: 1, minWidth: 0, gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: surface }}
    >
      <View style={{ width: theme.borderWidth.thick, borderRadius: theme.radius.pill, backgroundColor: accent }} />
      <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.xxs }}>
        <View className="flex-row items-center" style={{ gap: theme.spacing.xs }}>
          <Icon size={theme.iconSize.sm} color={accent} />
          <Text variant="caption" weight="semibold" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
          </Text>
        </View>
        {/* Keyed on the figures: an unchanged total never replays, a changed one fades in once. */}
        <Animated.View key={totals.map((total) => `${total.currency}:${total.amount}`).join('|')} entering={hasMounted ? VALUE_CHANGE : undefined}>
          {first === undefined ? (
            <Text weight="semibold" tone="muted" style={{ fontSize: theme.fontSize.lg }}>
              —
            </Text>
          ) : (
            <>
              <Money amount={first.amount} currency={first.currency} weight="bold" numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: theme.fontSize.lg }} />
              {rest.map((total) => (
                <Money key={total.currency} amount={total.amount} currency={total.currency} variant="label" weight="semibold" numberOfLines={1} />
              ))}
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

export function NetWorthSummarySkeleton() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={panelStyle(theme)}>
      <View style={{ gap: theme.spacing.xs }}>
        <SectionLabel>{t('accounts.netWorth')}</SectionLabel>
        <Skeleton width={theme.sizes.skeletonWidth.xxl} height={theme.sizes.skeletonLine.display} radius={theme.radius.sm} />
      </View>
      <View className="flex-row" style={{ gap: theme.spacing.sm }}>
        {[0, 1].map((key) => (
          <View key={key} style={{ flex: 1, gap: theme.spacing.xs, padding: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceMuted }}>
            <Skeleton width={theme.sizes.skeletonWidth.sm} height={theme.sizes.skeletonLine.caption} radius={theme.radius.sm} />
            <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
          </View>
        ))}
      </View>
    </View>
  );
}
