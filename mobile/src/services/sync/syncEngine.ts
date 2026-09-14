/**
 * The background sync engine: drains `pending`/`failed` queue rows in FIFO
 * order and replays each against the server with its stable idempotency key.
 *
 * `runSyncPass` is the platform-free core (testable under bare `node --test`
 * against a fake `OfflineQueue`/`EntityAdapters`/dispatch — no AppState, no
 * NetInfo). `startSyncEngine` is the one function that wires real triggers
 * (reconnect, foreground, interval) and is only exercised on-device.
 *
 * Cross-entity FK ordering: a queued transaction can reference a still-
 * unsynced local account id. Each row's payload is scanned for known
 * reference fields and resolved against the queue before firing the
 * request — a reference that hasn't synced yet defers the whole row (stays
 * `pending`, tried again next pass) rather than sending a local id the
 * server has never seen.
 */

import { isApiError, type ApiErrorLike } from '../../utils/errors.ts';
import type { EntityAdapters } from './entityAdapters.ts';
import type { OfflineQueue } from './offlineQueue.ts';
import type { QueueEntity, QueuedMutation } from './offlineQueueTypes.ts';

interface ReferenceField {
  field: string;
  refEntity: QueueEntity;
}

const REFERENCE_FIELDS: Partial<Record<QueueEntity, ReferenceField[]>> = {
  transaction: [
    { field: 'fromAccountId', refEntity: 'account' },
    { field: 'toAccountId', refEntity: 'account' },
    { field: 'categoryId', refEntity: 'category' },
  ],
  budget: [{ field: 'categoryId', refEntity: 'category' }],
  category: [{ field: 'parentId', refEntity: 'category' }],
};

type ResolveResult = { ok: true; payload: unknown } | { ok: false };

/** Swaps any embedded local id for its resolved server id; defers if not yet resolved. */
function resolveReferences(queue: OfflineQueue, entity: QueueEntity, payload: unknown): ResolveResult {
  const fields = REFERENCE_FIELDS[entity];
  if (!fields || typeof payload !== 'object' || payload === null) return { ok: true, payload };

  const resolved: Record<string, unknown> = { ...(payload as Record<string, unknown>) };

  for (const { field, refEntity } of fields) {
    const value = resolved[field];
    if (typeof value !== 'string') continue;

    const referenced = queue.current().find((row) => row.entity === refEntity && row.localId === value);
    if (!referenced) continue; // Not a queued local id — already a real server id.
    if (referenced.status !== 'synced' || !referenced.serverId) return { ok: false };

    resolved[field] = referenced.serverId;
  }

  return { ok: true, payload: resolved };
}

/** A row's own id, resolved against the queue the same way an embedded reference would be. */
function resolveOwnId(queue: OfflineQueue, row: QueuedMutation): string | null {
  if (row.op === 'create') return null; // No server id to target yet.
  if (row.serverId) return row.serverId;

  const created = queue.current().find(
    (candidate) => candidate.entity === row.entity && candidate.localId === row.localId && candidate.op === 'create',
  );
  if (created?.status === 'synced' && created.serverId) return created.serverId;
  return row.localId; // Assume localId already is a real id (record predates offline mode).
}

const ERROR_CODES_ARE_CONFLICTS = new Set(['FORBIDDEN']);

function classifyFailure(error: unknown): 'conflict' | 'failed' | 'network' {
  if (!isApiError(error)) return 'network';
  const apiError = error as ApiErrorLike;
  if (apiError.status === 403 || apiError.status === 404 || ERROR_CODES_ARE_CONFLICTS.has(apiError.code)) {
    return 'conflict';
  }
  if (apiError.status >= 400 && apiError.status < 500) return 'failed';
  return 'network';
}

function errorCodeOf(error: unknown): ApiErrorLike['code'] | null {
  return isApiError(error) ? (error as ApiErrorLike).code : null;
}

export interface SyncPassResult {
  synced: string[];
  conflicted: string[];
  failed: string[];
  deferred: string[];
  stoppedOnNetworkError: boolean;
}

let syncing = false;

/**
 * Drains one FIFO pass over `pending`/`failed` rows. Never runs two passes
 * concurrently — a reconnect firing mid-pass is a no-op, not a double-send
 * (the idempotency key would make a double-send safe anyway; this just
 * avoids the wasted request).
 */
export async function runSyncPass(
  queue: OfflineQueue,
  adapters: EntityAdapters,
  onSynced?: (row: QueuedMutation, serverId: string) => void,
): Promise<SyncPassResult> {
  const result: SyncPassResult = { synced: [], conflicted: [], failed: [], deferred: [], stoppedOnNetworkError: false };
  if (syncing) return result;
  syncing = true;

  try {
    await queue.refresh();
    const rows = queue
      .current()
      .filter((row) => row.status === 'pending' || row.status === 'failed')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    for (const row of rows) {
      const resolution = resolveReferences(queue, row.entity, row.payload);
      if (!resolution.ok) {
        result.deferred.push(row.queueId);
        continue;
      }

      await queue.markSyncing(row.queueId);
      const adapter = adapters[row.entity];

      try {
        if (row.op === 'create') {
          const response = await adapter.create(resolution.payload, row.idempotencyKey);
          await queue.markSynced(row.queueId, response.id);
          onSynced?.(row, response.id);
        } else {
          const targetId = resolveOwnId(queue, row);
          if (!targetId) {
            result.deferred.push(row.queueId);
            await queue.markPending(row.queueId);
            continue;
          }
          if (row.op === 'update') {
            await adapter.update(targetId, resolution.payload, row.idempotencyKey);
          } else {
            await adapter.cancelOrArchive(targetId, resolution.payload, row.idempotencyKey);
          }
          await queue.markSynced(row.queueId, targetId);
          onSynced?.(row, targetId);
        }
        result.synced.push(row.queueId);
      } catch (error) {
        const classification = classifyFailure(error);
        if (classification === 'conflict') {
          await queue.markConflict(row.queueId, errorCodeOf(error));
          result.conflicted.push(row.queueId);
        } else if (classification === 'failed') {
          await queue.markFailed(row.queueId, errorCodeOf(error), row.attempts + 1);
          result.failed.push(row.queueId);
        } else {
          // Network error: leave `pending` (never delete), stop the rest of this pass.
          await queue.markPending(row.queueId);
          result.stoppedOnNetworkError = true;
          break;
        }
      }
    }
  } finally {
    syncing = false;
  }

  return result;
}
