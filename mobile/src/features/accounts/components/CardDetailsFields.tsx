import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CARD_NETWORKS, accountTypeHasCard, accountTypeHasInstitution, type AccountType, type CardNetwork } from '@sora/contracts';

import { Input, Text, ThemedPressable } from '@/components';
import { useTheme } from '@/app/providers';
import { CARD_NETWORK_NAME } from '../cardNetworks.ts';
import { NetworkLogo, hasNetworkLogo } from './NetworkLogo.tsx';

export interface CardDetails {
  institutionName: string;
  cardNetwork: CardNetwork | null;
  cardLast4: string;
}

/**
 * The bank or provider, network and last four digits, shown only where the account's type may hold them
 * (`accountTypeHasCard`, `accountTypeHasInstitution`); cash shows nothing.
 */
export function CardDetailsFields({
  type,
  value,
  onChange,
  errors,
}: {
  type: AccountType;
  value: CardDetails;
  onChange: (next: CardDetails) => void;
  errors: Record<string, string | undefined>;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  if (!accountTypeHasInstitution(type)) return null;
  const hasCard = accountTypeHasCard(type);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View className="flex-row" style={{ gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Input
            testID="input-account-institutionName"
            label={t(hasCard ? 'accounts.bankName' : 'accounts.providerName')}
            placeholder={t(hasCard ? 'accounts.bankNamePlaceholder' : 'accounts.providerNamePlaceholder')}
            value={value.institutionName}
            onChangeText={(institutionName) => onChange({ ...value, institutionName })}
            error={errors.institutionName}
          />
        </View>
        {hasCard ? (
          <View style={{ width: theme.sizes.currencyField }}>
            <Input
              testID="input-account-cardLast4"
              label={t('accounts.cardLast4')}
              placeholder="1234"
              keyboardType="number-pad"
              maxLength={4}
              value={value.cardLast4}
              onChangeText={(digits) => onChange({ ...value, cardLast4: digits.replace(/\D/g, '') })}
              error={errors.cardLast4}
            />
          </View>
        ) : null}
      </View>

      {type === 'BANK_ACCOUNT' ? (
        <Text variant="caption" tone="muted">
          {t('accounts.debitCardHint')}
        </Text>
      ) : null}

      {hasCard ? (
        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" tone="muted">
            {t('accounts.cardNetwork')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.xs }}>
            {CARD_NETWORKS.map((network) => (
              <NetworkChip
                key={network}
                network={network}
                selected={value.cardNetwork === network}
                // Tapping the chosen network again clears it: the field is optional.
                onPress={() => onChange({ ...value, cardNetwork: value.cardNetwork === network ? null : network })}
              />
            ))}
          </ScrollView>
          {errors.cardNetwork !== undefined ? (
            <Text variant="caption" tone="danger">
              {errors.cardNetwork}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function NetworkChip({ network, selected, onPress }: { network: CardNetwork; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  const label = network === 'OTHER' ? t('accounts.networkOther') : CARD_NETWORK_NAME[network];

  return (
    <ThemedPressable
      testID={`btn-account-cardNetwork-${network}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className="flex-row items-center"
      style={{
        gap: theme.spacing.xs,
        minHeight: theme.sizes.touchTarget,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.pill,
        borderWidth: selected ? theme.borderWidth.medium : theme.borderWidth.thin,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        backgroundColor: selected ? theme.colors.primaryMuted : pressed ? theme.colors.surfaceMuted : theme.colors.surface,
      }}
    >
      {hasNetworkLogo(network) ? <NetworkLogo network={network} height={theme.iconSize.md} /> : null}
      <Text variant="caption" weight={selected ? 'semibold' : 'medium'} style={{ color: selected ? theme.colors.primary : theme.colors.text }}>
        {label}
      </Text>
    </ThemedPressable>
  );
}
