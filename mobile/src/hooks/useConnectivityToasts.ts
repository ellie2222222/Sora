import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth, useToast } from '@/app/providers';
import { isCurrentlyOnline, onOnlineChange } from '@/services/sync';
import { isDeviceOnline } from '@/utils';
import { INITIAL_NOTICE_STATE, noticeFor, type ConnectivityNotice } from './connectivityNotices.ts';

const NOTICE_KEY: Record<ConnectivityNotice, string> = {
  unreachable: 'errors.toastUnreachable',
  offline: 'errors.toastOffline',
  reconnected: 'errors.toastReconnected',
};

/**
 * One passing toast when the API stops answering, and one when it is back — never a screen in the way.
 * Signed-in only: a guest's data never leaves the device, and the sign-in screen has nothing to keep.
 */
export function useConnectivityToasts(): void {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { isAuthenticated, isGuest } = useAuth();
  const signedIn = isAuthenticated && !isGuest;
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;
  const state = useRef(INITIAL_NOTICE_STATE);

  const notify = useCallback(
    (online: boolean) => {
      const next = noticeFor(state.current, online, isDeviceOnline(), Date.now());
      state.current = next.state;
      if (next.notice !== null) showToast(t(NOTICE_KEY[next.notice]), next.notice === 'reconnected' ? 'success' : 'info');
    },
    [showToast, t],
  );

  useEffect(
    () =>
      onOnlineChange((online) => {
        if (signedInRef.current) notify(online);
      }),
    [notify],
  );

  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  // An outage that began while the session was still being restored never changes the flag again.
  useEffect(() => {
    if (signedIn && !isCurrentlyOnline()) notifyRef.current(false);
  }, [signedIn]);
}
