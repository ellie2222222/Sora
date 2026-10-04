import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { messageOf } from '@/utils';
import { ConfirmDialog } from './ConfirmDialog.tsx';

export interface MutationConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** The destructive write, e.g. `() => archive(id).unwrap()`. */
  run: () => Promise<unknown>;
  onCancel: () => void;
  onDone: () => void;
  /** Visibility is the caller's: it hides the dialog here too, and decides where the message shows. */
  onError: (message: string) => void;
}

/** A destructive confirmation that runs one write, shows it in flight, and ignores a second tap meanwhile. */
export function MutationConfirmDialog({ run, onDone, onError, ...dialog }: MutationConfirmDialogProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      await run();
      onDone();
    } catch (error) {
      onError(messageOf(error, t));
    } finally {
      setBusy(false);
    }
  }

  return <ConfirmDialog {...dialog} destructive loading={busy} onConfirm={() => void handleConfirm()} />;
}
