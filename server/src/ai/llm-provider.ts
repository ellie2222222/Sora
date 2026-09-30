/**
 * The seam a real model plugs into. A provider sees only what the toolbox
 * hands it — data the caller may already read — and can propose a transaction
 * but never record one: AiService validates the proposal, and only the user's
 * confirmation writes it.
 */

import type {
  AccountType,
  AiMessageRole,
  AiTransactionDraft,
  CategoryType,
  DashboardResponse,
  Locale,
  WalletRole,
  WalletStatus,
} from '@sora/contracts';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface WalletSnapshot {
  walletId: string;
  walletName: string;
  role: WalletRole;
  status: WalletStatus;
  accounts: { id: string; name: string; type: AccountType; currency: string; balance: string }[];
  categories: { id: string; name: string; type: CategoryType }[];
}

/** Read-only tools bound to one caller and one wallet they are a member of. */
export interface AiToolbox {
  walletSnapshot(): Promise<WalletSnapshot>;
  /** The current calendar month's dashboard figures (BR-06 already applied). */
  monthSummary(): Promise<DashboardResponse>;
}

export interface LlmRequest {
  locale: Locale;
  message: string;
  /** Oldest first, capped by AiService so a long chat cannot outgrow a context window. */
  history: { role: AiMessageRole; content: string }[];
  toolbox: AiToolbox;
  now: Date;
}

export interface LlmProposal {
  transaction: AiTransactionDraft;
  accountName: string;
  categoryName: string;
}

export interface LlmReply {
  content: string;
  proposal?: LlmProposal;
}

export interface LlmProvider {
  readonly name: string;
  reply(request: LlmRequest): Promise<LlmReply>;
}
