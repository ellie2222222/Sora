import { useMemo, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import { guestStore, guestUploadTask, uploadStatusOf, type GuestUploadTaskState, type UploadPhase, type UploadStepCount } from '@/services/guest';

const subscribeTask = (listener: () => void) => guestUploadTask.subscribe(listener);
const subscribeData = (listener: () => void) => guestStore.subscribe(listener);
const dataSnapshot = () => guestStore.current();

export function useGuestUploadTask(): GuestUploadTaskState {
  return useSyncExternalStore(subscribeTask, guestUploadTask.current);
}

export interface GuestUploadView {
  donePhases: readonly UploadPhase[];
  steps: Readonly<Record<UploadPhase, UploadStepCount>>;
  doneRows: number;
  totalRows: number;
  fraction: number;
}

/** Steps and rows uploaded so far; the fraction moves with every row, not only between steps. */
export function useGuestUploadView(finished: boolean): GuestUploadView {
  const data = useSyncExternalStore(subscribeData, dataSnapshot);
  return useMemo(() => {
    const status = uploadStatusOf(data, finished);
    return { ...status, fraction: status.totalRows === 0 ? 0 : status.doneRows / status.totalRows };
  }, [data, finished]);
}

/** A count in the app language's digit grouping: 1,688 in English, 1.688 in Vietnamese. */
export function useCountFormat(): (value: number) => string {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const format = new Intl.NumberFormat(i18n.language);
    return (value: number) => format.format(value);
  }, [i18n.language]);
}
