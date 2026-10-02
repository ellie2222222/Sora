import { Check, ChevronDown, ChevronLeft, ChevronRight, Plus, UsersRound, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { WalletResponse } from '@sora/contracts';

import { BottomSheetModal, Button, Text } from '@/components';
import { useAuth, useTheme, useWallets } from '@/app/providers';
import { getRoleLabel } from '@/utils';
import type { AppStackParamList } from '@/app/navigation';
import { CreateWalletForm } from './CreateWalletForm.tsx';
import { InviteMemberPanel } from './InviteMemberPanel.tsx';
import { WalletActivityPanel } from './WalletActivityPanel.tsx';
import { WalletDetailPanel } from './WalletDetailPanel.tsx';
import { WalletMembersPanel } from './WalletMembersPanel.tsx';

type SheetPage =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'detail' | 'members' | 'invite' | 'activity'; walletId: string };

const LIST_PAGE: SheetPage = { kind: 'list' };

function parentOf(page: SheetPage): SheetPage {
  switch (page.kind) {
    case 'members':
    case 'activity':
      return { kind: 'detail', walletId: page.walletId };
    case 'invite':
      return { kind: 'members', walletId: page.walletId };
    default:
      return LIST_PAGE;
  }
}

/**
 * The product's headline surface: every wallet you own, alongside every one
 * shared with you, each showing how you relate to it. Also where wallets are
 * managed — details, members, invitations and activity are pages of this one
 * sheet, so no second modal has to present while this one is dismissing.
 */
export function WalletSwitcher() {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { isGuest } = useAuth();
  const { wallets, activeWallet, setActiveWalletId, isLoading } = useWallets();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<SheetPage>(LIST_PAGE);

  const formatWalletName = (name: string) => (name === 'Guest Wallet' ? t('wallets.yourWallet') : name);
  const displayNameOf = (wallet: WalletResponse) =>
    wallet.isOwn ? formatWalletName(wallet.name) : wallet.relationLabel ?? formatWalletName(wallet.name);



  const currentWallet = activeWallet ?? wallets[0] ?? null;
  const displayName = currentWallet ? displayNameOf(currentWallet) : t('wallets.yourWallet', { defaultValue: 'Your wallet' });

  const close = () => setOpen(false);
  // Account screens live in the app stack, so the sheet gets out of the way before navigating there.
  const leaveSheetFor = (go: () => void) => {
    close();
    go();
  };

  const pageTitle = (): string => {
    switch (page.kind) {
      case 'list':
        return t('wallets.title');
      case 'create':
        return t('wallets.newWallet');
      case 'detail': {
        const wallet = wallets.find((candidate) => candidate.id === page.walletId);
        return wallet !== undefined ? displayNameOf(wallet) : t('wallets.walletDetails');
      }
      case 'members':
        return t('wallets.members');
      case 'invite':
        return t('members.invite');
      case 'activity':
        return t('activity.title');
    }
  };

  const renderPage = () => {
    switch (page.kind) {
      case 'list':
        return (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: theme.spacing.xs }}>
            {wallets.map((wallet) => (
              <WalletRow
                key={wallet.id}
                wallet={wallet}
                active={wallet.id === activeWallet?.id}
                onPress={() => {
                  setActiveWalletId(wallet.id);
                  close();
                }}
                onOpenDetails={() => setPage({ kind: 'detail', walletId: wallet.id })}
              />
            ))}
          </ScrollView>
        );
      case 'create':
        return <CreateWalletForm active onCreated={() => setPage(LIST_PAGE)} />;
      case 'detail':
        return (
          <WalletDetailPanel
            walletId={page.walletId}
            onOpenMembers={() => setPage({ kind: 'members', walletId: page.walletId })}
            onOpenActivity={() => setPage({ kind: 'activity', walletId: page.walletId })}
            onOpenAccount={(accountId) => leaveSheetFor(() => navigation.navigate('AccountDetail', { accountId }))}
            onAddAccount={() => leaveSheetFor(() => navigation.navigate('AddAccount', { walletId: page.walletId }))}
            onOpenCategories={() => leaveSheetFor(() => navigation.navigate('CategoryList', { walletId: page.walletId }))}
            onWalletGone={() => setPage(LIST_PAGE)}
          />
        );
      case 'members':
        return (
          <WalletMembersPanel
            walletId={page.walletId}
            onInvite={() => setPage({ kind: 'invite', walletId: page.walletId })}
          />
        );
      case 'invite':
        return (
          <InviteMemberPanel
            walletId={page.walletId}
            onSent={() => setPage({ kind: 'members', walletId: page.walletId })}
          />
        );
      case 'activity':
        return <WalletActivityPanel walletId={page.walletId} />;
    }
  };

  return (
    <>
      <Pressable
        testID="picker-wallet"
        onPress={() => {
          setPage(LIST_PAGE);
          setOpen(true);
        }}
        className="flex-row items-center"
        style={{ gap: theme.spacing.sm }}
      >
        {currentWallet && !currentWallet.isOwn ? (
          <UsersRound size={16} color={theme.colors.primary} />
        ) : (
          <Wallet size={18} color={theme.colors.primary} />
        )}
        <Text variant="title" numberOfLines={1} isLoading={isLoading} skeletonWidth={120}>
          {displayName}
        </Text>
        <ChevronDown size={18} color={theme.colors.textMuted} />
      </Pressable>

      <BottomSheetModal visible={open} onClose={close} testID="sheet-wallet">
        <View
          className="flex-row items-center justify-between"
          style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}
        >
          <View className="flex-row items-center flex-1" style={{ gap: theme.spacing.xs }}>
            {page.kind !== 'list' ? (
              <Pressable
                testID="btn-back-wallet"
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
                onPress={() => setPage(parentOf(page))}
              >
                <ChevronLeft size={22} color={theme.colors.text} />
              </Pressable>
            ) : null}
            <Text variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
              {pageTitle()}
            </Text>
          </View>
          {page.kind === 'list' && !isGuest ? (
            <Button
              testID="btn-add-wallet"
              label={t('wallets.newWallet')}
              size="sm"
              icon={Plus}
              onPress={() => setPage({ kind: 'create' })}
            />
          ) : null}
        </View>

        {renderPage()}
      </BottomSheetModal>
    </>
  );
}

function WalletRow({
  wallet,
  active,
  onPress,
  onOpenDetails,
}: {
  wallet: WalletResponse;
  active: boolean;
  onPress: () => void;
  onOpenDetails: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const formatWalletName = (name: string) => (name === 'Guest Wallet' ? t('wallets.yourWallet') : name);
  const displayName = wallet.isOwn ? formatWalletName(wallet.name) : wallet.relationLabel ?? formatWalletName(wallet.name);

  return (
    <Pressable
      testID={`option-wallet-${wallet.id}`}
      onPress={onPress}
      className="flex-row items-center justify-between"
      style={{
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xs,
        borderRadius: theme.radius.md,
        backgroundColor: active ? theme.colors.primaryMuted : 'transparent',
      }}
    >
      <View className="flex-row items-center flex-1" style={{ gap: theme.spacing.sm }}>
        {!wallet.isOwn ? <UsersRound size={16} color={theme.colors.textMuted} /> : null}
        <View className="flex-1">
          <Text weight={active ? 'semibold' : 'regular'}>{displayName}</Text>
          {!wallet.isOwn ? (
            <Text variant="caption" tone="muted">
              {formatWalletName(wallet.name)} · {getRoleLabel(wallet.role, t)}
            </Text>
          ) : displayName !== t('wallets.yourWallet') ? (
            <Text variant="caption" tone="muted">
              {t('wallets.yourWallet', { defaultValue: 'Your wallet' })}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
        {active ? <Check size={16} color={theme.colors.primary} /> : null}
        <Pressable
          testID={`btn-view-wallet-${wallet.id}`}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`${t('wallets.walletDetails')}: ${displayName}`}
          onPress={onOpenDetails}
        >
          <ChevronRight size={20} color={theme.colors.textMuted} />
        </Pressable>
      </View>
    </Pressable>
  );
}
