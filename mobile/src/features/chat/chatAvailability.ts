/** Why the assistant can't act right now, if it can't: offline beats view-only (AI-US-01). */
export type ChatBlockedReason = 'offline' | 'viewOnly' | null;

export function chatAvailability(state: { isOnline: boolean; isSending: boolean; canWrite: boolean }): {
  canSend: boolean;
  blockedReason: ChatBlockedReason;
} {
  return {
    canSend: state.isOnline && !state.isSending,
    blockedReason: !state.isOnline ? 'offline' : !state.canWrite ? 'viewOnly' : null,
  };
}
