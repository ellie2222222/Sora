import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft } from 'lucide-react-native';

import { AnimatedScreen, Button, Card, Text } from '@/components';
import { useTheme } from '@/app/providers';
import type { MainTabScreenProps } from '@/app/navigation';
import {
  AboutSection,
  AppearanceSection,
  LanguageSection,
  ProfileHeader,
  SettingsBottomActions,
  SettingsDivider,
  SyncSection,
} from '../components';
import { useCreateTransactionMutation, useListAccountsQuery, useListCategoriesQuery } from '@/app/store';
import { TransactionType, TransactionStatus } from '@sora/contracts';
import { nowInstant } from '@/utils';
import { useWallets } from '@/app/providers';

type SectionKey = 'appearance' | 'language' | 'sync' | 'about';

export function SettingsScreen({ navigation: _navigation }: MainTabScreenProps<'Settings'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { activeWallet, permissions } = useWallets();
  const { data: accounts } = useListAccountsQuery(
    { walletId: activeWallet?.id as string },
    { skip: !activeWallet?.id }
  );
  const { data: categories } = useListCategoriesQuery(
    { walletId: activeWallet?.id as string },
    { skip: !activeWallet?.id }
  );
  const [createTransaction] = useCreateTransactionMutation();

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    appearance: false,
    language: false,
    sync: false,
    about: false,
  });

  const toggleSection = (id: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <AnimatedScreen>
      <ScrollView
        testID="screen-settings"
        className="flex-1"
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={{
          padding: theme.spacing.md,
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.xl,
          gap: theme.spacing.md,
        }}
      >
        <Card
          testID="settings-profile-card"
          style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.border }}
        >
          <ProfileHeader />
        </Card>

        <View className="gap-sm">
          <Text
            variant="label"
            weight="bold"
            tone="muted"
            style={{
              paddingHorizontal: theme.spacing.xs,
              textTransform: 'uppercase',
              letterSpacing: 1,
              fontSize: 11,
            }}
          >
            {t('settings.title', 'Settings')}
          </Text>

          <Card
            padded={false}
            testID="settings-group"
            style={{
              overflow: 'hidden',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.border,
            }}
          >
            <AppearanceSection
              isOpen={!!openSections.appearance}
              onToggle={() => toggleSection('appearance')}
            />

            <SettingsDivider />

            <LanguageSection
              isOpen={!!openSections.language}
              onToggle={() => toggleSection('language')}
            />

            <SettingsDivider />

            <SyncSection
              isOpen={!!openSections.sync}
              onToggle={() => toggleSection('sync')}
            />

            <SettingsDivider />

            <AboutSection
              isOpen={!!openSections.about}
              onToggle={() => toggleSection('about')}
            />
          </Card>
        </View>


        <SettingsBottomActions />

        <View style={{ marginTop: theme.spacing.xl, paddingBottom: theme.spacing.md }}>
          <Text variant="caption" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
            Dev Tools (Test Transactions)
          </Text>
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              variant="secondary"
              label="Add test INCOME"
              icon={ArrowDownToLine}
              disabled={!permissions.canWrite || !accounts?.[0] || !categories?.[0]}
              onPress={() => {
                if (!accounts?.[0] || !categories?.[0]) return;
                createTransaction({
                  type: TransactionType.INCOME,
                  status: TransactionStatus.COMPLETED,
                  amount: "100000",
                  currency: "VND",
                  description: "Test Income",
                  transactionDate: nowInstant(),
                  categoryId: categories[0]!.id,
                  toAccountId: accounts[0]!.id,
                });
              }}
            />
            <Button
              variant="secondary"
              label="Add test EXPENSE"
              icon={ArrowUpFromLine}
              disabled={!permissions.canWrite || !accounts?.[0] || !categories?.[0]}
              onPress={() => {
                if (!accounts?.[0] || !categories?.[0]) return;
                createTransaction({
                  type: TransactionType.EXPENSE,
                  status: TransactionStatus.COMPLETED,
                  amount: "50000",
                  currency: "VND",
                  description: "Test Expense",
                  transactionDate: nowInstant(),
                  categoryId: categories[0]!.id,
                  fromAccountId: accounts[0]!.id,
                });
              }}
            />
            <Button
              variant="secondary"
              label="Add test TRANSFER"
              icon={ArrowRightLeft}
              disabled={!permissions.canWrite || !accounts || accounts.length < 2}
              onPress={() => {
                if (!accounts || accounts.length < 2) return;
                createTransaction({
                  type: TransactionType.TRANSFER,
                  status: TransactionStatus.COMPLETED,
                  amount: "20000",
                  currency: "VND",
                  description: "Test Transfer",
                  transactionDate: nowInstant(),
                  categoryId: undefined,
                  fromAccountId: accounts[0]!.id,
                  toAccountId: accounts[1]!.id,
                });
              }}
            />
          </View>
        </View>
      </ScrollView>
    </AnimatedScreen>
  );
}
