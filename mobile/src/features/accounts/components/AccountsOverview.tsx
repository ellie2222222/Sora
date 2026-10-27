import { Landmark, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { ACCOUNT_TYPES, AccountStatus } from '@sora/contracts';

import { SectionLabel, StateView, Text, ThemedIcon } from '@/components';
import { useModal, useTheme } from '@/app/providers';
import type { Theme } from '@/design-system';
import { useListAccountsQuery } from '@/app/store';
import { isNetworkError } from '@/utils';
import { netWorthByCurrency } from '../netWorth.ts';
import { AccountCarousel, AccountCarouselSkeleton } from './AccountCarousel.tsx';
import { NetWorthSummary, NetWorthSummarySkeleton } from './NetWorthSummary.tsx';
import { ACCOUNT_ICON, ACCOUNT_TYPE_LABEL_KEY } from './AccountPicker.tsx';

/** A wallet's accounts with its net worth, and the entry point for adding one. */
export function AccountsOverview({
  walletId,
  canWrite,
  onOpenAccount,
}: {
  walletId: string;
  canWrite: boolean;
  onOpenAccount: (accountId: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const accounts = useListAccountsQuery({ walletId, status: AccountStatus.ACTIVE });

  // `currentData` is empty while another wallet's accounts load, where `data` would still show the old wallet's.
  if (accounts.currentData === undefined && accounts.isFetching) return <AccountsOverviewSkeleton />;
  if (accounts.isError && (!isNetworkError(accounts.error) || accounts.currentData === undefined)) {
    return (
      <StateView
        variant="error"
        error={accounts.error}
        retryAction={() => void accounts.refetch()}
        testID="accounts-error"
        entrance="none"
      />
    );
  }

  const items = accounts.currentData ?? [];

  // Before the first account there is no net worth to report, and three "—"
  // rows above the prompt read as a broken screen rather than a new one.
  if (items.length === 0) {
    return (
      <StateView
        variant="empty"
        icon={Landmark}
        title={t('accounts.noAccountsTitle')}
        message={t('accounts.noAccountsMessage')}
        primaryAction={
          canWrite ? { label: t('accounts.addAccount'), onPress: () => openModal('AddAccount', { walletId }), icon: Plus } : undefined
        }
        quickActions={
          canWrite
            ? ACCOUNT_TYPES.map((type) => ({
                label: t(ACCOUNT_TYPE_LABEL_KEY[type]),
                icon: ACCOUNT_ICON[type],
                onPress: () => openModal('AddAccount', { walletId, accountType: type }),
              }))
            : undefined
        }
        testID="accounts-empty"
        entrance="none"
      />
    );
  }

  const { assets, liabilities, netWorth } = netWorthByCurrency(items);

  return (
    <View testID="section-accounts" style={{ gap: theme.spacing.xl }}>
      <NetWorthSummary walletId={walletId} netWorth={netWorth} assets={assets} liabilities={liabilities} />

      <View style={{ gap: theme.spacing.xs }}>
        <View style={{ zIndex: 1 }}>
          <SectionLabel
            action={
              canWrite ? (
                <Pressable
                  testID="btn-add-account"
                  accessibilityRole="button"
                  onPress={() => openModal('AddAccount', { walletId })}
                  hitSlop={{
                    top: (theme.sizes.touchTarget - theme.lineHeight.sm) / 2,
                    bottom: (theme.sizes.touchTarget - theme.lineHeight.sm) / 2,
                    left: theme.sizes.hitSlop.lg,
                    right: theme.sizes.hitSlop.lg,
                  }}
                  className="flex-row items-center"
                  style={{ gap: theme.spacing.xxs }}
                >
                  <ThemedIcon icon={Plus} size={theme.iconSize.sm} color={theme.colors.primary} />
                  <Text variant="label" weight="semibold" style={{ color: theme.colors.primary }}>
                    {t('accounts.addAccount')}
                  </Text>
                </Pressable>
              ) : undefined
            }
          >
            {t('accounts.accountsLabel')}
          </SectionLabel>
        </View>

        {/* `entering` runs on mount only, so a refetch or a balance change never replays it. */}
        <Animated.View entering={FadeInDown.duration(CARD_ENTER_MS)} style={{ marginTop: -deckGlowOverlap(theme) }}>
          <AccountCarousel accounts={items} onOpenAccount={onOpenAccount} />
        </Animated.View>
      </View>
    </View>
  );
}

const CARD_ENTER_MS = 240;
// The deck reserves its glow's full reach above the front card; that faded band may sit behind the label row (zIndex above).
const deckGlowOverlap = (theme: Theme) => theme.spacing.huge;

export function AccountsOverviewSkeleton() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <NetWorthSummarySkeleton />

      <View style={{ gap: theme.spacing.xs }}>
        <SectionLabel>{t('accounts.accountsLabel')}</SectionLabel>
        <View style={{ marginTop: -deckGlowOverlap(theme) }}>
          <AccountCarouselSkeleton />
        </View>
      </View>
    </View>
  );
}
