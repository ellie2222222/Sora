import { memo } from 'react';
import { Nfc } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { AccountResponse, AccountType } from '@sora/contracts';

import { Money, SyncStatusDot, Text, ThemedIcon, ThemedView } from '@/components';
import { useTheme } from '@/app/providers';
import { selectQueueEntryFor } from '@/app/store';
import { ACCOUNT_CARD_TEXT, ACCOUNT_CARD_TEXTURE, type AccountCardSkin, type Radius, type Theme } from '@/design-system';
import { cardBalanceOf } from '../accountBalance.ts';
import { CARD_NETWORK_NAME, cardDetailsOf, maskedCardDigits } from '../cardNetworks.ts';
import { ACCOUNT_ICON, ACCOUNT_TYPE_LABEL_KEY } from './AccountPicker.tsx';
import { NetworkLogo, hasNetworkLogo } from './NetworkLogo.tsx';

type Texture = 'none' | 'guilloche' | 'rings';

/**
 * Colour says *which* account (a skin no other card in the wallet wears), texture and shape say *what kind*: bank and
 * credit card carry a chip (credit adds the contactless mark), cash a banknote's wavy guilloche with tight
 * corners, an e-wallet an app's soft rings with round corners.
 */
const CARD_LOOK: Record<AccountType, { texture: Texture; chip: boolean; contactless: boolean; radius: keyof Radius }> = {
  BANK_ACCOUNT: { texture: 'none', chip: true, contactless: false, radius: 'xl' },
  CREDIT_CARD: { texture: 'none', chip: true, contactless: true, radius: 'xl' },
  CASH: { texture: 'guilloche', chip: false, contactless: false, radius: 'md' },
  E_WALLET: { texture: 'rings', chip: false, contactless: false, radius: 'xxl' },
};

/** The card's corner radius, which its backlight and shadow follow. */
export function accountCardRadius(type: AccountType, theme: Theme): number {
  return theme.radius[CARD_LOOK[type].radius];
}

export const AccountCard = memo(function AccountCard({
  account,
  skin,
  width,
  onPress,
}: {
  account: AccountResponse;
  skin: AccountCardSkin;
  width: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const syncStatus = useSelector(selectQueueEntryFor('account', account.id))?.status;
  const look = CARD_LOOK[account.type];
  const radius = accountCardRadius(account.type, theme);
  const height = width / theme.sizes.accountCard.aspectRatio;
  const TypeIcon = ACCOUNT_ICON[account.type];
  const { institutionName, cardNetwork, cardLast4 } = cardDetailsOf(account);
  const shownBalance = cardBalanceOf(account);

  return (
    <Pressable
      testID={`row-account-${account.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        width,
        height,
        borderRadius: radius,
        padding: theme.spacing.lg,
        justifyContent: 'space-between',
        overflow: 'hidden',
      }}
    >
      <CardSkin accountId={account.id} skin={skin} texture={look.texture} width={width} height={height} radius={radius} />

      <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
        <View className="flex-row items-center" style={{ flex: 1, gap: theme.spacing.xs }}>
          <Text variant="title" numberOfLines={1} style={{ flexShrink: 1, color: ACCOUNT_CARD_TEXT.text }}>
            {account.name}
          </Text>
          <SyncStatusDot status={syncStatus} />
        </View>
        {cardNetwork !== null && cardNetwork !== 'OTHER' ? (
          <CardNetworkMark network={cardNetwork} />
        ) : (
          <ThemedIcon icon={TypeIcon} size={theme.iconSize.xl} color={ACCOUNT_CARD_TEXT.text} />
        )}
      </View>

      {look.chip ? (
        <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
          <CardChip />
          {look.contactless ? <ThemedIcon icon={Nfc} size={theme.iconSize.xl} color={ACCOUNT_CARD_TEXT.text} /> : null}
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.xxs }}>
        {shownBalance.owed ? (
          <Text variant="caption" weight="semibold" style={{ color: ACCOUNT_CARD_TEXT.muted }} testID={`account-card-owed-${account.id}`}>
            {t('accounts.owed')}
          </Text>
        ) : null}
        <Money
          amount={shownBalance.amount}
          currency={account.currency}
          weight="semibold"
          numberOfLines={1}
          style={{ fontSize: theme.fontSize.xxl, color: ACCOUNT_CARD_TEXT.text }}
          testID={`account-card-balance-${account.id}`}
        />
        <Text variant="caption" numberOfLines={1} style={{ color: ACCOUNT_CARD_TEXT.muted }} testID={`account-card-caption-${account.id}`}>
          {[
            institutionName ?? t(ACCOUNT_TYPE_LABEL_KEY[account.type]),
            cardLast4 !== null ? maskedCardDigits(cardLast4) : null,
            account.currency,
          ]
            .filter((part) => part !== null)
            .join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
});

function CardSkin({
  accountId,
  skin,
  texture,
  width,
  height,
  radius,
}: {
  accountId: string;
  skin: AccountCardSkin;
  texture: Texture;
  width: number;
  height: number;
  radius: number;
}) {
  const theme = useTheme();
  const gradientId = `skin-${accountId}`;
  const clipId = `clip-${accountId}`;
  const line = { stroke: ACCOUNT_CARD_TEXT.text, strokeOpacity: ACCOUNT_CARD_TEXTURE.line, strokeWidth: theme.iconStroke.thin, fill: 'none' };

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={skin.from} />
          <Stop offset="1" stopColor={skin.to} />
        </LinearGradient>
        <ClipPath id={clipId}>
          <Rect width={width} height={height} rx={radius} ry={radius} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clipId})`}>
        <Rect width={width} height={height} fill={`url(#${gradientId})`} />
        {/* The lit diagonal half of a card under a light, as on a printed card. */}
        <Polygon
          points={`${width * 0.55},0 ${width},0 ${width},${height} ${width * 0.25},${height}`}
          fill={ACCOUNT_CARD_TEXT.text}
          fillOpacity={ACCOUNT_CARD_TEXTURE.facet}
        />
        {texture === 'guilloche'
          ? [0.3, 0.45, 0.6, 0.75].map((row) => (
              <Path key={row} d={wavePath(width, height * row, height * 0.06)} {...line} />
            ))
          : null}
        {texture === 'rings'
          ? [0.35, 0.55, 0.75].map((share) => <Circle key={share} cx={width} cy={0} r={height * share} {...line} />)
          : null}
      </G>
    </Svg>
  );
}

/** A banknote's guilloche: a smooth wave across the card at `y`, three crests wide. */
function wavePath(width: number, y: number, amplitude: number): string {
  const step = width / 6;
  let d = `M 0 ${y}`;
  for (let i = 0; i < 6; i++) {
    const dir = i % 2 === 0 ? -1 : 1;
    d += ` Q ${step * i + step / 2} ${y + dir * amplitude * 2} ${step * (i + 1)} ${y}`;
  }
  return d;
}

/** The network's mark where one is drawn, else its name set as a wordmark. */
function CardNetworkMark({ network }: { network: Exclude<NonNullable<AccountResponse['cardNetwork']>, 'OTHER'> }) {
  const theme = useTheme();
  if (hasNetworkLogo(network)) return <NetworkLogo network={network} height={theme.iconSize.xxl} monoColor={ACCOUNT_CARD_TEXT.text} />;
  return (
    <Text weight="bold" style={{ fontSize: theme.fontSize.xl, fontStyle: 'italic', color: ACCOUNT_CARD_TEXT.text }}>
      {CARD_NETWORK_NAME[network]}
    </Text>
  );
}

function CardChip() {
  const theme = useTheme();
  const { width, height } = theme.sizes.accountCard.chip;
  return (
    <ThemedView
      className="justify-center"
      style={{ width, height, borderRadius: theme.radius.sm, borderWidth: theme.borderWidth.medium, borderColor: ACCOUNT_CARD_TEXT.muted }}
    >
      <ThemedView style={{ height: theme.borderWidth.medium, backgroundColor: ACCOUNT_CARD_TEXT.muted }} />
    </ThemedView>
  );
}
