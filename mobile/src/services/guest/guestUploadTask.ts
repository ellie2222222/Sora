/**
 * The one running guest → account upload, owned outside any screen so it keeps going
 * when the upload screen closes. Plain state with subscribers, like `guestStore`: the
 * screen, the background indicator and `AuthProvider` all read the same run.
 */

import { GuestUploadCancelledError } from './guestUpload.ts';

/**
 * `stopping`: Cancel was pressed and the request already in flight is finishing.
 * `stopped`/`failed`: nothing running; the progress maps let a resume continue.
 * `done`: everything uploaded; whoever shows the confirmation resets it.
 */
export type GuestUploadStatus = 'idle' | 'running' | 'stopping' | 'stopped' | 'failed' | 'done';

export interface GuestUploadTaskState {
  status: GuestUploadStatus;
  walletId: string | null;
  error: unknown;
  /** The user left the upload screen; the app shows instead, with a progress indicator. */
  inBackground: boolean;
}

export type GuestUploadRun = (signal: AbortSignal) => Promise<void>;

const IDLE: GuestUploadTaskState = {
  status: 'idle',
  walletId: null,
  error: null,
  inBackground: false,
};

export function createGuestUploadTask() {
  let state = IDLE;
  let controller: AbortController | null = null;
  // A reset while a run is still settling must not let that run write its outcome back.
  let generation = 0;
  const listeners = new Set<(next: GuestUploadTaskState) => void>();

  function set(patch: Partial<GuestUploadTaskState>): void {
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
  }

  return {
    current: (): GuestUploadTaskState => state,

    subscribe(listener: (next: GuestUploadTaskState) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Starts, or resumes, an upload into `walletId`. A second call while one runs is ignored. */
    async start(walletId: string, run: GuestUploadRun): Promise<void> {
      if (state.status === 'running' || state.status === 'stopping') return;
      const runGeneration = ++generation;
      const runController = new AbortController();
      controller = runController;
      set({ status: 'running', walletId, error: null });

      try {
        await run(runController.signal);
        if (runGeneration === generation) set({ status: 'done' });
      } catch (error) {
        if (runGeneration !== generation) return;
        if (error instanceof GuestUploadCancelledError) set({ status: 'stopped' });
        else set({ status: 'failed', error });
      } finally {
        if (controller === runController) controller = null;
      }
    },

    cancel(): void {
      if (state.status !== 'running' || !controller) return;
      controller.abort();
      set({ status: 'stopping' });
    },

    setInBackground(inBackground: boolean): void {
      if (state.inBackground !== inBackground) set({ inBackground });
    },

    /** Forgets the run (sign-out, or a finished upload acknowledged); a run still settling is ignored. */
    reset(): void {
      controller?.abort();
      controller = null;
      generation++;
      state = IDLE;
      for (const listener of listeners) listener(state);
    },
  };
}

export type GuestUploadTask = ReturnType<typeof createGuestUploadTask>;

export const guestUploadTask = createGuestUploadTask();
