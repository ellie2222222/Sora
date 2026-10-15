import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import type { CalendarDay } from '@sora/contracts';

import { chosenDay, today } from '@/utils';

/**
 * A selected day that follows the wallet's today until the user moves it (rule 18). Mounting before
 * the wallet loads reads the device zone; following, rather than seeding once, picks up the wallet's.
 */
export function useWalletDay(timeZone: string): [CalendarDay, Dispatch<SetStateAction<CalendarDay>>] {
  const [chosen, setChosen] = useState<CalendarDay | null>(null);
  const setDay = useCallback<Dispatch<SetStateAction<CalendarDay>>>(
    (next) =>
      setChosen((current) => {
        const walletToday = today(timeZone);
        const value = typeof next === 'function' ? next(current ?? walletToday) : next;
        return chosenDay(value, walletToday);
      }),
    [timeZone],
  );
  return [chosen ?? today(timeZone), setDay];
}
