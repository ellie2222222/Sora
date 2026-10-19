/**
 * Which toast, if any, a change in API reachability earns. One notice per outage and one when it ends,
 * and none for an outage starting again within the cooldown: a flapping connection (a read failing just
 * after the probe saw the API back) must not stack toasts over the screen the user is working in.
 */

export const OUTAGE_NOTICE_COOLDOWN_MS = 2 * 60_000;

export type ConnectivityNotice = 'unreachable' | 'offline' | 'reconnected';

export interface NoticeState {
  lastOutageNoticeAt: number | null;
  /** An outage toast was shown and its "back" toast has not been yet. */
  outageNoticed: boolean;
}

export const INITIAL_NOTICE_STATE: NoticeState = { lastOutageNoticeAt: null, outageNoticed: false };

export function noticeFor(
  state: NoticeState,
  online: boolean,
  deviceOnline: boolean,
  now: number,
): { state: NoticeState; notice: ConnectivityNotice | null } {
  if (online) {
    if (!state.outageNoticed) return { state, notice: null };
    return { state: { ...state, outageNoticed: false }, notice: 'reconnected' };
  }
  if (state.lastOutageNoticeAt !== null && now - state.lastOutageNoticeAt < OUTAGE_NOTICE_COOLDOWN_MS) {
    return { state, notice: null };
  }
  return {
    state: { lastOutageNoticeAt: now, outageNoticed: true },
    notice: deviceOnline ? 'unreachable' : 'offline',
  };
}
