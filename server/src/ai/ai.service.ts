/**
 * The assistant's conversations: each belongs to one user, and every message
 * is answered from one wallet the user is a member of at the moment it is sent.
 *
 * The assistant only ever proposes a transaction. Confirming one goes through
 * TransactionsService.create — the same authorization, currency and category
 * checks and audit row as POST /transactions — so the chat is no looser a
 * write path than the form.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  AccountStatus,
  AiActionStatus,
  AiActionType,
  AiMessageRole,
  aiTransactionDraftSchema,
  CategoryStatus,
  REQUIRED_ROLE,
  roleSatisfies,
  TransactionType,
  WalletStatus,
  type AiConversationQuery,
  type AiConversationResponse,
  type AiMessageResponse,
  type CreateAiConversationRequest,
  type SendAiMessageResponse,
  type sendAiMessageSchema,
} from '@sora/contracts';
import type { Selectable } from 'kysely';
import type { z } from 'zod';

import { localizedCategoryName } from '../categories/category-name.ts';
import { AppError } from '../common/app-error.ts';
import type { AuthenticatedUser } from '../common/decorators.ts';
import { paginated, type Enveloped } from '../common/envelope.ts';
import { paginationMeta } from '../common/pagination.ts';
import { DatabaseService } from '../database/database.service.ts';
import type { AiActionPayload, AiConversationsTable, AiMessagesTable, Executor } from '../database/types.ts';
import { TransactionsService } from '../transactions/transactions.service.ts';
import { WalletAccessService, type WalletAccess } from '../wallets/wallet-access.service.ts';
import { AiToolsService } from './ai-tools.service.ts';
import { LLM_PROVIDER, type LlmProposal, type LlmProvider } from './llm-provider.ts';

/** How many earlier messages a provider sees; the stored history is never trimmed. */
const HISTORY_WINDOW = 15;
const DEFAULT_TITLE = 'New conversation';

type ConversationRow = Selectable<AiConversationsTable>;
type MessageRow = Selectable<AiMessagesTable>;

@Injectable()
export class AiService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: WalletAccessService,
    private readonly tools: AiToolsService,
    private readonly transactions: TransactionsService,
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
  ) {}

  async listConversations(
    user: AuthenticatedUser,
    query: AiConversationQuery,
  ): Promise<Enveloped<AiConversationResponse[]>> {
    const base = this.database.db.selectFrom('ai_conversations').where('user_id', '=', user.id);
    const [{ total }, rows] = await Promise.all([
      base.select((eb) => eb.fn.countAll<string>().as('total')).executeTakeFirstOrThrow(),
      base
        .selectAll()
        .orderBy('updated_at', 'desc')
        .orderBy('id', 'desc')
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize)
        .execute(),
    ]);
    return paginated(rows.map(toConversationResponse), paginationMeta(query.page, query.pageSize, Number(total)));
  }

  async createConversation(user: AuthenticatedUser, request: CreateAiConversationRequest): Promise<AiConversationResponse> {
    if (request.walletId !== undefined) await this.access.require(user.id, request.walletId, 'VIEWER');

    const row = await this.database.db
      .insertInto('ai_conversations')
      .values({ user_id: user.id, wallet_id: request.walletId ?? null, title: request.title ?? DEFAULT_TITLE })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toConversationResponse(row);
  }

  /** Chat history is the user's own, not financial data, so it is removed outright with its messages. */
  async deleteConversation(user: AuthenticatedUser, conversationId: string): Promise<AiConversationResponse> {
    const row = await this.database.db
      .deleteFrom('ai_conversations')
      .where('id', '=', conversationId)
      .where('user_id', '=', user.id)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw new AppError('AI_CONVERSATION_NOT_FOUND');
    return toConversationResponse(row);
  }

  /** Newest first, so the first page is the end of the chat. */
  async listMessages(
    user: AuthenticatedUser,
    conversationId: string,
    query: AiConversationQuery,
  ): Promise<Enveloped<AiMessageResponse[]>> {
    await this.ownConversation(user, conversationId);

    const base = this.database.db.selectFrom('ai_messages').where('conversation_id', '=', conversationId);
    const [{ total }, rows] = await Promise.all([
      base.select((eb) => eb.fn.countAll<string>().as('total')).executeTakeFirstOrThrow(),
      base
        .selectAll()
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize)
        .execute(),
    ]);
    return paginated(await this.toMessageResponses(rows), paginationMeta(query.page, query.pageSize, Number(total)));
  }

  async sendMessage(
    user: AuthenticatedUser,
    conversationId: string,
    request: z.output<typeof sendAiMessageSchema>,
  ): Promise<SendAiMessageResponse> {
    await this.ownConversation(user, conversationId);
    const walletAccess = await this.access.require(user.id, request.walletId, 'VIEWER');

    const recent = await this.database.db
      .selectFrom('ai_messages')
      .select(['role', 'content'])
      .where('conversation_id', '=', conversationId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(HISTORY_WINDOW)
      .execute();

    const reply = await this.provider.reply({
      locale: request.locale,
      message: request.message,
      history: recent.reverse(),
      toolbox: this.tools.toolbox(user, walletAccess),
      now: new Date(),
    });
    const proposal = await this.acceptedProposal(reply.proposal, walletAccess);

    return this.database.db.transaction().execute(async (trx) => {
      const userMessage = await trx
        .insertInto('ai_messages')
        .values({ conversation_id: conversationId, role: AiMessageRole.USER, content: request.message })
        .returningAll()
        .executeTakeFirstOrThrow();

      // A later timestamp than the user's row, so newest-first ordering never shows the answer before the question.
      const assistantMessage = await trx
        .insertInto('ai_messages')
        .values({
          conversation_id: conversationId,
          role: AiMessageRole.ASSISTANT,
          content: reply.content,
          created_at: new Date(new Date(userMessage.created_at).getTime() + 1),
          ...(proposal
            ? {
                action_type: AiActionType.CREATE_TRANSACTION,
                action_payload: JSON.stringify(proposal satisfies AiActionPayload),
                action_status: AiActionStatus.PENDING,
              }
            : {}),
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const conversation = await trx
        .updateTable('ai_conversations')
        .set({ wallet_id: walletAccess.walletId, updated_at: new Date() })
        .where('id', '=', conversationId)
        .returningAll()
        .executeTakeFirstOrThrow();

      return {
        conversation: toConversationResponse(conversation),
        userMessage: toMessageResponse(userMessage),
        assistantMessage: toMessageResponse(assistantMessage),
      };
    });
  }

  /**
   * Records the proposed transaction. The message row stays locked while the
   * transaction is created, so two taps cannot both find it PENDING and record it twice.
   */
  async confirmAction(
    user: AuthenticatedUser,
    conversationId: string,
    messageId: string,
    ip: string | null,
  ): Promise<AiMessageResponse> {
    await this.ownConversation(user, conversationId);

    return this.database.db.transaction().execute(async (trx) => {
      const message = await trx
        .selectFrom('ai_messages')
        .selectAll()
        .where('id', '=', messageId)
        .where('conversation_id', '=', conversationId)
        .forUpdate()
        .executeTakeFirst();
      if (!message || message.action_type === null) throw new AppError('AI_MESSAGE_NOT_FOUND');
      if (message.action_status !== AiActionStatus.PENDING) throw new AppError('AI_ACTION_NOT_PENDING');

      const draft = aiTransactionDraftSchema.parse(message.action_payload!.transaction);
      const recorded = await this.transactions.create(user, draft, ip, trx);

      const updated = await trx
        .updateTable('ai_messages')
        .set({ action_status: AiActionStatus.CONFIRMED, action_transaction_id: recorded.id })
        .where('id', '=', messageId)
        .returningAll()
        .executeTakeFirstOrThrow();
      return (await this.toMessageResponses([updated], trx))[0]!;
    });
  }

  async dismissAction(user: AuthenticatedUser, conversationId: string, messageId: string): Promise<AiMessageResponse> {
    await this.ownConversation(user, conversationId);

    const message = await this.database.db
      .selectFrom('ai_messages')
      .select(['id', 'action_type', 'action_status'])
      .where('id', '=', messageId)
      .where('conversation_id', '=', conversationId)
      .executeTakeFirst();
    if (!message || message.action_type === null) throw new AppError('AI_MESSAGE_NOT_FOUND');

    const updated = await this.database.db
      .updateTable('ai_messages')
      .set({ action_status: AiActionStatus.DISMISSED })
      .where('id', '=', messageId)
      .where('action_status', '=', AiActionStatus.PENDING)
      .returningAll()
      .executeTakeFirst();
    if (!updated) throw new AppError('AI_ACTION_NOT_PENDING');
    return (await this.toMessageResponses([updated]))[0]!;
  }

  /**
   * A proposal stores the category name it was drafted with; a later read names the category as the
   * reader reads it now, so a language switch or a rename doesn't leave old proposals showing the old name.
   */
  private async toMessageResponses(rows: readonly MessageRow[], executor: Executor = this.database.db): Promise<AiMessageResponse[]> {
    const categoryIds = [...new Set(rows.flatMap((row) => (row.action_payload ? [row.action_payload.transaction.categoryId] : [])))];
    const current = categoryIds.length === 0
      ? []
      : await executor
        .selectFrom('categories')
        .select(['id', localizedCategoryName('categories').as('name')])
        .where('id', 'in', categoryIds)
        .execute();
    const nameById = new Map(current.map((category) => [category.id, category.name]));
    return rows.map((row) => toMessageResponse(row, nameById));
  }

  /** Another user's conversation id answers 404, the same as one that does not exist. */
  private async ownConversation(user: AuthenticatedUser, conversationId: string): Promise<ConversationRow> {
    const row = await this.database.db
      .selectFrom('ai_conversations')
      .selectAll()
      .where('id', '=', conversationId)
      .where('user_id', '=', user.id)
      .executeTakeFirst();
    if (!row) throw new AppError('AI_CONVERSATION_NOT_FOUND');
    return row;
  }

  /**
   * A provider's proposal is kept only when the caller could record it and it
   * names this wallet's own active account and category. A real model can be
   * wrong or be steered; this check does not depend on it being right.
   */
  private async acceptedProposal(proposal: LlmProposal | undefined, access: WalletAccess): Promise<LlmProposal | null> {
    if (proposal === undefined) return null;
    if (!roleSatisfies(access.role, REQUIRED_ROLE.WRITE) || access.status !== WalletStatus.ACTIVE) return null;

    const parsed = aiTransactionDraftSchema.safeParse(proposal.transaction);
    if (!parsed.success) return null;
    const draft = parsed.data;
    const accountId = draft.type === TransactionType.EXPENSE ? draft.fromAccountId : draft.toAccountId;

    const [account, category] = await Promise.all([
      this.database.db
        .selectFrom('accounts')
        .select(['currency', 'status'])
        .where('id', '=', accountId)
        .where('wallet_id', '=', access.walletId)
        .executeTakeFirst(),
      this.database.db
        .selectFrom('categories')
        .select(['type', 'status'])
        .where('id', '=', draft.categoryId)
        .where('wallet_id', '=', access.walletId)
        .executeTakeFirst(),
    ]);
    if (!account || account.status !== AccountStatus.ACTIVE || account.currency !== draft.currency) return null;
    if (!category || category.status !== CategoryStatus.ACTIVE || category.type !== draft.type) return null;

    return { transaction: draft, accountName: proposal.accountName, categoryName: proposal.categoryName };
  }
}

function toConversationResponse(row: ConversationRow): AiConversationResponse {
  return {
    id: row.id,
    walletId: row.wallet_id,
    title: row.title,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toMessageResponse(row: MessageRow, categoryNameById: ReadonlyMap<string, string> = new Map()): AiMessageResponse {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    action:
      row.action_type !== null && row.action_payload !== null && row.action_status !== null
        ? {
            type: row.action_type,
            status: row.action_status,
            transaction: row.action_payload.transaction,
            accountName: row.action_payload.accountName,
            categoryName: categoryNameById.get(row.action_payload.transaction.categoryId) ?? row.action_payload.categoryName,
            transactionId: row.action_transaction_id,
          }
        : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
