import { Injectable, Logger } from '@nestjs/common';
import type { Kysely, Transaction } from 'kysely';

import type { AuditLogResponse, WalletRole } from '@finance/contracts';

import { DatabaseService } from '../database/database.service.ts';
import type { AuditResult, DB } from '../database/types.ts';
import type { AuditEvent, EntityType } from './audit-events.ts';

export interface AuditRecord {
  event: AuditEvent;
  entityType: EntityType;
  entityId?: string | null;
  actorId?: string | null;
  walletId?: string | null;
  result?: AuditResult;
  actorRole?: WalletRole | null;
  note?: string | null;
  ip?: string | null;
}

/** §15.1's `?event=`/`?dateFrom=`/`?dateTo=` filters, already paged. */
export interface AuditLogFilter {
  event?: string;
  /** Calendar day, inclusive, compared against `created_at`. */
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export interface AuditLogPage {
  rows: AuditLogResponse[];
  total: number;
}

/** Column length of audit_logs.note; a longer note is truncated, not rejected. */
const NOTE_LIMIT = 500;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly database: DatabaseService) {}

  /**
   * Append one row.
   *
   * Pass `executor` to write inside a caller's transaction, so an audited change
   * and its record commit or roll back together. Without it the row is written
   * on its own connection.
   *
   * A failure here is logged and swallowed: losing the record of a transfer is
   * bad, but failing the transfer *because* the record could not be written is
   * worse, and the log line preserves the event either way.
   */
  async record(entry: AuditRecord, executor?: Kysely<DB> | Transaction<DB>): Promise<void> {
    const db = executor ?? this.database.db;

    this.logger.log(
      `${entry.event} result=${entry.result ?? 'SUCCESS'} actor=${entry.actorId ?? 'anonymous'} wallet=${entry.walletId ?? '-'} entity=${entry.entityType}:${entry.entityId ?? '-'}`,
    );

    try {
      await db
        .insertInto('audit_logs')
        .values({
          actor_id: entry.actorId ?? null,
          wallet_id: entry.walletId ?? null,
          event: entry.event,
          entity_type: entry.entityType,
          entity_id: entry.entityId ?? null,
          result: entry.result ?? 'SUCCESS',
          actor_role: entry.actorRole ?? null,
          note: entry.note ? entry.note.slice(0, NOTE_LIMIT) : null,
          ip: entry.ip ?? null,
        })
        .execute();
    } catch (error) {
      this.logger.error(`Failed to write audit row for ${entry.event}: ${(error as Error).message}`);
    }
  }

  /**
   * Paginated, append-only read of one wallet's trail (§15.1) — `idx_audit_logs_wallet_date`
   * covers the `wallet_id` filter plus the `created_at DESC` order in one index.
   */
  async listForWallet(walletId: string, filter: AuditLogFilter): Promise<AuditLogPage> {
    let query = this.database.db.selectFrom('audit_logs').where('wallet_id', '=', walletId);

    if (filter.event) query = query.where('event', '=', filter.event);
    if (filter.dateFrom) {
      query = query.where('created_at', '>=', new Date(`${filter.dateFrom}T00:00:00.000Z`));
    }
    if (filter.dateTo) query = query.where('created_at', '<', dayAfter(filter.dateTo));

    const totalRow = await query
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();

    const rows = await query
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(filter.pageSize)
      .offset((filter.page - 1) * filter.pageSize)
      .execute();

    return { total: Number(totalRow.count), rows: rows.map(toAuditLogResponse) };
  }
}

/** Exclusive upper bound for an inclusive calendar-day filter on a TIMESTAMPTZ column. */
function dayAfter(date: string): Date {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function toAuditLogResponse(row: {
  id: string;
  event: string;
  entity_type: string;
  entity_id: string | null;
  result: AuditResult;
  actor_id: string | null;
  actor_role: string | null;
  note: string | null;
  created_at: Date;
}): AuditLogResponse {
  return {
    id: row.id,
    event: row.event,
    entityType: row.entity_type,
    entityId: row.entity_id,
    result: row.result,
    actorId: row.actor_id,
    actorRole: row.actor_role as WalletRole | null,
    note: row.note,
    createdAt: row.created_at.toISOString(),
  };
}
