'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle, Info, Trash2 } from 'lucide-react'
import { Alert } from './alert'
import { Button } from './button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'

/**
 * How serious the action is.
 *
 *   destructive — data or its effect is reversed and cannot be reinstated
 *                 (cancelling a transaction, deleting a workspace)
 *   warning     — the change is significant but recoverable
 *                 (archiving an account or category)
 *   info        — a confirmation for its own sake; nothing is lost
 */
export type ConfirmVariant = 'destructive' | 'warning' | 'info'

export interface ConfirmDialogProps {
  /** Modal wrapper id, e.g. `modal-confirm-cancel-transaction` (NC-04). */
  id: string
  open: boolean
  onOpenChange: (open: boolean) => void
  variant?: ConfirmVariant
  title: string
  /** What will happen, in one sentence. */
  description?: string
  /** The record being acted on — a name, amount, or date. */
  detail?: React.ReactNode
  confirmLabel: string
  cancelLabel: string
  /**
   * Awaited. While it runs the dialog locks and the confirm button shows a
   * spinner; it closes on resolve. On rejection the dialog stays open and shows
   * `errorMessage`, so a failed delete is never mistaken for a successful one.
   */
  onConfirm: () => void | Promise<void>
  /** Shown when onConfirm rejects. Required for any confirm that can fail. */
  errorMessage?: string
}

const VARIANT_STYLES: Record<
  ConfirmVariant,
  { icon: React.ReactNode; iconWrap: string; confirm: 'destructive' | 'warning' | 'primary' }
> = {
  destructive: {
    icon: <Trash2 className="h-5 w-5" />,
    iconWrap: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400',
    confirm: 'destructive',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5" />,
    iconWrap: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    confirm: 'warning',
  },
  info: {
    icon: <Info className="h-5 w-5" />,
    iconWrap: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
    confirm: 'primary',
  },
}

/**
 * Confirmation for an action that cannot simply be undone with a click.
 *
 * Replaces `window.confirm`, which cannot be styled, ignores the app's theme and
 * locale, blocks the main thread, offers no loading or error state, and carries
 * no stable id for E2E tests (FE-01).
 */
export function ConfirmDialog({
  id,
  open,
  onOpenChange,
  variant = 'destructive',
  title,
  description,
  detail,
  confirmLabel,
  cancelLabel,
  onConfirm,
  errorMessage,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const style = VARIANT_STYLES[variant]

  useEffect(() => {
    if (open) setFailed(false)
  }, [open])

  const confirm = async () => {
    try {
      setBusy(true)
      setFailed(false)
      await onConfirm()
      onOpenChange(false)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent id={id} className="max-w-md" hideClose={busy}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.iconWrap}`}
              aria-hidden="true"
            >
              {style.icon}
            </div>
            <div className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription className="mt-1">{description}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>

        {detail && (
          <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-slate-800/60 dark:text-gray-200">
            {detail}
          </div>
        )}

        {failed && <Alert type="error" message={errorMessage ?? title} />}

        <DialogFooter>
          <Button
            id={`${id}-cancel`}
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            id={`${id}-confirm`}
            type="button"
            variant={style.confirm}
            loading={busy}
            disabled={busy}
            onClick={confirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
