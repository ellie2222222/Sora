import type { LucideIcon } from 'lucide-react-native';
import { ArrowLeft, CalendarSearch, Landmark, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { StateView, type StateViewAction } from '@/components';
import type { DashboardEmptyReason } from '@/utils';

export interface DashboardEmptyProps {
  reason: DashboardEmptyReason;
  /** The window being viewed, already formatted — e.g. "September 2026". */
  periodLabel: string;
  canWrite: boolean;
  onAddAccount: () => void;
  onAddTransaction: () => void;
  onPreviousPeriod: () => void;
}

/**
 * The dashboard with nothing to plot.
 *
 * Each reason gets its own copy and its own next step: a wallet with no
 * accounts, a wallet that has never recorded anything, and a window that simply
 * has nothing in it are three different situations, and one shared "no data"
 * message would leave two of them with no way forward.
 */
export function DashboardEmpty({
  reason,
  periodLabel,
  canWrite,
  onAddAccount,
  onAddTransaction,
  onPreviousPeriod,
}: DashboardEmptyProps) {
  const { t } = useTranslation();

  const addTransaction: StateViewAction | undefined = canWrite
    ? { label: t('dashboard.addTransaction'), onPress: onAddTransaction, icon: Plus }
    : undefined;

  const copy: Record<DashboardEmptyReason, { icon: LucideIcon; title: string; message: string }> = {
    'no-accounts': {
      icon: Landmark,
      title: t('dashboard.noAccountsTitle'),
      message: t('dashboard.noAccountsMessage'),
    },
    'no-transactions': {
      icon: CalendarSearch,
      title: t('dashboard.nothingRecordedTitle'),
      message: t('dashboard.nothingRecordedMessage'),
    },
    'empty-period': {
      icon: CalendarSearch,
      title: t('dashboard.emptyPeriodTitle', { period: periodLabel }),
      message: t('dashboard.emptyPeriodMessage'),
    },
  };

  const { icon, title, message } = copy[reason];

  return (
    <StateView
      variant="empty"
      icon={icon}
      title={title}
      message={message}
      primaryAction={
        reason === 'no-accounts'
          ? canWrite
            ? { label: t('accounts.addAccount'), onPress: onAddAccount, icon: Plus }
            : undefined
          : reason === 'empty-period'
            ? { label: t('dashboard.viewPreviousPeriod'), onPress: onPreviousPeriod, icon: ArrowLeft }
            : addTransaction
      }
      secondaryAction={reason === 'empty-period' ? addTransaction : undefined}
      testID={`dashboard-empty-${reason}`}
    />
  );
}
