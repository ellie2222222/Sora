import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ZERO, formatMoney, type Scaled, type TransactionType } from '@sora/contracts';

import { useTheme } from '@/app/providers';
import { Money } from './Money.tsx';
import { Text } from './Text.tsx';

export interface OtherCurrencyFigure {
  amount: Scaled;
  /** Signs and colours the figure; omit for one that is neither income nor expense. */
  type?: TransactionType;
  color?: string;
}

export interface OtherCurrencyRow {
  currency: string;
  figures: readonly OtherCurrencyFigure[];
}

/**
 * Figures in the currencies besides the headline one, a line per currency, because they are never added
 * into it (BR-07). Sign and colour say which side a figure is, so a zero is left out rather than shown as
 * an unlabelled 0.
 */
export function OtherCurrencies({ rows, testID }: { rows: readonly OtherCurrencyRow[]; testID?: string }) {
  const theme = useTheme();
  const { t } = useTranslation();

  const shown = rows
    .map((row) => ({ ...row, figures: row.figures.filter((figure) => figure.amount !== ZERO) }))
    .filter((row) => row.figures.length > 0);
  if (shown.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.xxs }} testID={testID}>
      <Text variant="caption" tone="faint">
        {t('common.otherCurrencies')}
      </Text>
      {shown.map((row) => (
        <View key={row.currency} className="flex-row flex-wrap items-center" style={{ columnGap: theme.spacing.md }}>
          {row.figures.map((figure, index) => (
            <Money
              key={index}
              amount={formatMoney(figure.amount)}
              currency={row.currency}
              type={figure.type}
              variant="caption"
              weight="semibold"
              style={figure.color !== undefined ? { color: figure.color } : undefined}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
