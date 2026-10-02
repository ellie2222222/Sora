import { CloudOff, Plus, Wallet as WalletIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { SkeletonList, StateView } from '@/components';
import { useAuth, useModal, useWallets } from '@/app/providers';

/**
 * What a wallet-scoped screen shows when there is no active wallet. An unreachable
 * server with no saved copy means the wallets are unknown, so it must not offer to
 * create one as if the user had none.
 */
export function NoWalletState({
  title,
  message,
  testID,
  entrance,
}: {
  title?: string;
  message?: string;
  testID: string;
  entrance?: 'bounce' | 'none';
}) {
  const { t } = useTranslation();
  const { isGuest } = useAuth();
  const { openModal } = useModal();
  const { isLoading, isError, isUnavailable, refetch } = useWallets();

  if (isLoading) return null;
  if (isError) {
    return (
      <StateView
        variant="error"
        error={new Error(t('errors.loadWalletsFailed'))}
        retryAction={refetch}
        testID={`${testID}-error`}
        entrance={entrance}
      />
    );
  }

  if (isUnavailable) {
    return (
      <StateView
        variant="informational"
        icon={CloudOff}
        title={t('wallets.unavailableTitle')}
        message={t('wallets.unavailableMessage')}
        primaryAction={{ label: t('common.tryAgain'), onPress: refetch }}
        testID={`${testID}-unavailable`}
        entrance={entrance}
      />
    );
  }

  return (
    <StateView
      variant="empty"
      icon={WalletIcon}
      title={title ?? t('home.noWalletTitle')}
      message={message ?? t('home.noWalletDescription')}
      primaryAction={
        isGuest ? undefined : { label: t('wallets.newWallet'), onPress: () => openModal('CreateWallet'), icon: Plus }
      }
      testID={testID}
      entrance={entrance}
    />
  );
}
