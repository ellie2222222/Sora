/**
 * Which cached reads a synced write refreshes, and when.
 *
 * An offline write shows only as a patch on the cached reads, so refetching one of those reads
 * while the write is still open replaces the patch with server data that doesn't have it yet, and
 * the user's own change vanishes from the screen. A tag any open row touches is therefore held,
 * and its refresh deferred until the last such row syncs or is discarded.
 *
 * Plain strings, no React Native or RTK import, so this stays testable under bare `node --test`.
 */

import type { QueuedMutation, QueueEntity } from './offlineQueueTypes.ts';

/** The same sets the online mutations invalidate: a synced write replaces every figure its offline patch moved. */
export const ENTITY_TAGS: Record<QueueEntity, readonly string[]> = {
  transaction: ['Transaction', 'Account', 'Dashboard', 'Budget', 'Wallet', 'Goal', 'GoalContribution'],
  account: ['Account', 'Wallet', 'Dashboard'],
  budget: ['Budget', 'Dashboard'],
  goal: ['Goal', 'Dashboard'],
  category: ['Category', 'Budget', 'Dashboard', 'Transaction'],
  // A contribution moves goal progress, and one recorded as a transaction moves balances too.
  contribution: ['Goal', 'GoalContribution', 'Transaction', 'Account', 'Dashboard', 'Budget', 'Wallet'],
};

export function heldTags(rows: readonly QueuedMutation[]): Set<string> {
  const held = new Set<string>();
  for (const row of rows) {
    if (row.status !== 'synced') for (const tag of ENTITY_TAGS[row.entity]) held.add(tag);
  }
  return held;
}

/** Collects refreshes asked for while their tags are held, and hands them out once nothing holds them. */
export class DeferredInvalidation {
  private readonly waiting = new Set<string>();

  /** Of `tags` and every earlier deferred one, those no open row in `rows` holds; the rest keep waiting. */
  release(tags: Iterable<string>, rows: readonly QueuedMutation[]): string[] {
    for (const tag of tags) this.waiting.add(tag);
    const held = heldTags(rows);
    const ready = [...this.waiting].filter((tag) => !held.has(tag));
    for (const tag of ready) this.waiting.delete(tag);
    return ready;
  }
}
