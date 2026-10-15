import {
  aiTransactionDraftSchema,
  formatMoney,
  parseMoney,
  REQUIRED_ROLE,
  roleSatisfies,
  TransactionType,
  WalletStatus,
  type AccountType,
  type AiMessageRole,
  type CategoryType,
  type Locale,
  type WalletRole,
} from '@sora/contracts';
import { z } from 'zod';

import type {
  LlmReply,
  LlmRequest,
} from './llm-provider.ts';

// ---------------------------------------------------------------------------
// 1. AI Intent & Context Definitions
// ---------------------------------------------------------------------------

/**
 * The intents recognized and classified by Sora's financial AI assistant.
 */
export const UserIntent = {
  RECORD_TRANSACTION: 'RECORD_TRANSACTION',
  QUERY_BALANCES: 'QUERY_BALANCES',
  QUERY_SPENDING: 'QUERY_SPENDING',
  QUERY_BUDGETS: 'QUERY_BUDGETS',
  QUERY_GOALS: 'QUERY_GOALS',
  GENERAL_ASSISTANCE: 'GENERAL_ASSISTANCE',
} as const;

export type UserIntent = (typeof UserIntent)[keyof typeof UserIntent];

/**
 * Full wallet and financial context assembled for Gemini inference.
 */
export interface GroupedAiContext {
  intent: UserIntent;
  confidence: number;
  entities: Record<string, unknown>;
  userMessage: string;
  locale: Locale;
  now: Date;
  /** System instructions and business rules tailored to the assistant. */
  systemInstructions: string;
  /** Structured wallet context including permitted accounts and categories. */
  walletContext?: {
    walletId: string;
    walletName: string;
    role: WalletRole;
    canWrite: boolean;
    status: WalletStatus;
    accounts: { id: string; name: string; type: AccountType; currency: string; balance: string }[];
    categories: { id: string; name: string; type: CategoryType }[];
  };
  /** Derived financial data (retrieved dynamically from the toolbox). */
  financialData?: {
    balances?: { accountName: string; balance: string; currency: string }[];
    monthSpending?: {
      totals: { amount: string; currency: string }[];
      byCategory: { categoryName: string; percentage: number }[];
    };
    budgets?: {
      name: string;
      spent: string;
      amount: string;
      currency: string;
      usagePercentage: number;
      isOverBudget: boolean;
    }[];
    goals?: {
      name: string;
      currentAmount: string;
      targetAmount: string;
      currency: string;
      progressPercentage: number;
    }[];
  };
  /** Conversation history window. */
  history: { role: AiMessageRole; content: string }[];
}

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  fallbackModel?: string;
}

// ---------------------------------------------------------------------------
// 2. AI Context Assembly & Prompt Construction
// ---------------------------------------------------------------------------

/**
 * Assembles full wallet context and financial data for Gemini,
 * empowering the AI to perform natural multilingual intent detection
 * and formulate targeted replies/proposals directly without static keyword filtering.
 */
export async function buildAiContext(request: LlmRequest): Promise<GroupedAiContext> {
  const [snapshot, summary] = await Promise.all([
    request.toolbox.walletSnapshot(),
    request.toolbox.monthSummary(),
  ]);

  const walletContext: GroupedAiContext['walletContext'] = {
    walletId: snapshot.walletId,
    walletName: snapshot.walletName,
    role: snapshot.role,
    canWrite: roleSatisfies(snapshot.role, REQUIRED_ROLE.WRITE),
    status: snapshot.status,
    accounts: snapshot.accounts,
    categories: snapshot.categories,
  };

  const financialData: GroupedAiContext['financialData'] = {
    balances: snapshot.accounts.map((acc) => ({
      accountName: acc.name,
      balance: acc.balance,
      currency: acc.currency,
    })),
    monthSpending: {
      totals: summary.expense,
      byCategory: summary.spendingByCategory.map((c) => ({
        categoryName: c.categoryName,
        percentage: c.percentage,
      })),
    },
    budgets: summary.activeBudgets.map((b) => ({
      name: b.name,
      spent: b.spent,
      amount: b.amount,
      currency: b.currency,
      usagePercentage: b.usagePercentage,
      isOverBudget: b.isOverBudget,
    })),
    goals: summary.activeGoals.map((g) => ({
      name: g.name,
      currentAmount: g.currentAmount,
      targetAmount: g.targetAmount,
      currency: g.currency,
      progressPercentage: g.progressPercentage,
    })),
  };

  const systemInstructions = buildAiSystemInstructions(request.locale, walletContext, financialData);

  return {
    intent: UserIntent.GENERAL_ASSISTANCE,
    confidence: 1.0,
    entities: {},
    userMessage: request.message,
    locale: request.locale,
    now: request.now,
    systemInstructions,
    walletContext,
    financialData,
    history: request.history,
  };
}

export function buildAiSystemInstructions(
  locale: Locale,
  walletContext?: GroupedAiContext['walletContext'],
  financialData?: GroupedAiContext['financialData'],
): string {
  const parts: string[] = [
    `You are the embedded finance assistant for Sora. Your goal is to resolve user queries concisely and accurately.`,
    ``,
    `CONSTRAINTS & RULES:`,
    `1. Direct Answers Only: Never use conversational filler phrases like "I can help with that", "Sure!", "Here is the information", or "I have prepared a draft". Deliver the direct answer or action immediately.`,
    `2. Boundary Enforcement: If a user asks about topics outside of personal and shared finance, wallets, accounts, budgets, goals, or transactions, decline politely in their language.`,
    `3. No Markdown: Return raw, unstyled plain text in the "content" field. Do not include markdown headers, bolding asterisks, or code blocks.`,
    `4. Language & Locale: You are communicating in locale: "${locale}". Always reply in this exact language.`,
    `5. Strictly Derived Figures: Never invent or calculate numbers yourself. All balances, spent totals, budget usage, and goal progress must come strictly from the provided context (derived figures are never guessed).`,
    `6. Currency Isolation: Totals are strictly per-currency; never sum, convert, or mix across different currencies (BR-13).`,
    `7. Draft Proposals Only: The assistant can ONLY propose a transaction draft. It never creates or commits transactions directly.`,
    ``,
    `INTENT DETECTION & HANDLING:`,
    `Detect the user's intent naturally in any language and classify it into one of the following in your output:`,
    `- "RECORD_TRANSACTION": The user wants to log or record an expense or income (e.g. spent money, bought items, received funds/salary). If the user has write access, formulate a transaction draft proposal in the "proposal" field with matching accountId, categoryId, amount scaled to 4 decimals (e.g. "50000.0000"), and matching account currency. If the account or category is ambiguous, ask the user to clarify instead of guessing. If the user has VIEWER-only access, do not propose a draft and explain they cannot record transactions.`,
    `- "QUERY_BALANCES": The user asks about accounts, balances, or available money. Report account balances clearly as provided.`,
    `- "QUERY_SPENDING": The user asks about monthly spending, expenses, or category breakdown. Report monthly spending accurately from the provided financial data.`,
    `- "QUERY_BUDGETS": The user asks about budgets, limits, or remaining allowance. Report active budget limits, spent amounts, and utilization percentages.`,
    `- "QUERY_GOALS": The user asks about savings goals, targets, or progress. Report savings goals and progress percentages.`,
    `- "GENERAL_ASSISTANCE": General finance questions, greetings, "who are you", or questions about the wallet.`,
  ];

  if (walletContext) {
    parts.push(
      `Current wallet: "${walletContext.walletName}" (ID: ${walletContext.walletId}, Role: ${walletContext.role}, Active: ${walletContext.status === WalletStatus.ACTIVE}, Can Write: ${walletContext.canWrite}).`,
    );
    if (!walletContext.canWrite) {
      parts.push(`The user has VIEWER-only access. You MUST NOT propose any transaction drafts; politely explain that they cannot create transactions in this wallet.`);
    }
  }

  if (walletContext?.accounts && walletContext.accounts.length > 0) {
    parts.push(`Available accounts: ${JSON.stringify(walletContext.accounts.map((a) => ({ id: a.id, name: a.name, type: a.type, currency: a.currency, balance: a.balance })))}`);
  }

  if (walletContext?.categories && walletContext.categories.length > 0) {
    parts.push(`Available categories: ${JSON.stringify(walletContext.categories.map((c) => ({ id: c.id, name: c.name, type: c.type })))}`);
  }

  if (financialData) {
    parts.push(`Financial data: ${JSON.stringify(financialData)}`);
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// 3. Response Validation & Defensive Model Execution
// ---------------------------------------------------------------------------

/**
 * Strips markdown code blocks (```json ... ```) or accidental wrappers from model output.
 */
export function cleanJsonText(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return cleaned;
}

export const rawGeminiResponseSchema = z.object({
  intent: z
    .enum([
      'RECORD_TRANSACTION',
      'QUERY_BALANCES',
      'QUERY_SPENDING',
      'QUERY_BUDGETS',
      'QUERY_GOALS',
      'GENERAL_ASSISTANCE',
    ])
    .optional(),
  content: z.string().min(1),
  proposal: z
    .object({
      type: z.nativeEnum(TransactionType),
      accountId: z.string().uuid(),
      categoryId: z.string().uuid(),
      amount: z.string().min(1),
      currency: z.string().min(1),
      description: z.string().optional(),
      transactionDate: z.string().optional(),
    })
    .optional(),
});

function sleepWithJitter(baseMs: number, jitterMaxMs: number = 200): Promise<void> {
  const jitter = Math.floor(Math.random() * jitterMaxMs);
  return new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
}

interface GeminiCallSuccess {
  ok: true;
  rawJsonText: string;
}

interface GeminiCallFailure {
  ok: false;
  status?: number;
  errorText: string;
  isClientError: boolean;
  isRateLimit: boolean;
  isServerError: boolean;
  isTimeout: boolean;
}

type GeminiCallResult = GeminiCallSuccess | GeminiCallFailure;

async function callSingleModel(
  model: string,
  apiKey: string,
  payload: object,
  timeoutMs: number,
): Promise<GeminiCallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        ok: false,
        status: response.status,
        errorText: errorText.slice(0, 300),
        isClientError: response.status === 400,
        isRateLimit: response.status === 429,
        isServerError: response.status >= 500 && response.status < 600,
        isTimeout: false,
      };
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJsonText) {
      return {
        ok: false,
        errorText: 'No candidate parts in response',
        isClientError: false,
        isRateLimit: false,
        isServerError: false,
        isTimeout: false,
      };
    }

    return { ok: true, rawJsonText };
  } catch (error: any) {
    const isTimeout = error?.name === 'TimeoutError' || error?.message?.includes('timeout') || error?.code === 23;
    return {
      ok: false,
      errorText: error?.message || String(error),
      isClientError: false,
      isRateLimit: false,
      isServerError: false,
      isTimeout,
    };
  }
}

/**
 * Executes the request using Google Gemini generateContent API with structured output,
 * Zod validation, defensive exponential backoff with random jitter, and automatic
 * model fallback (Primary -> Fallback -> Deterministic Mock).
 */
export async function executeWithGemini(
  context: GroupedAiContext,
  request: LlmRequest,
  config: GeminiConfig,
  fallback?: () => Promise<LlmReply>,
): Promise<LlmReply> {
  const primaryModel = config.model || 'gemini-3.8-flash';
  const fallbackModel = config.fallbackModel || 'gemini-3.1-flash-lite';
  const isTest = process.env.NODE_ENV === 'test';

  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

  for (const msg of context.history) {
    contents.push({
      role: msg.role === 'ASSISTANT' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  contents.push({
    role: 'user',
    parts: [{ text: context.userMessage }],
  });

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      intent: {
        type: 'STRING',
        enum: [
          'RECORD_TRANSACTION',
          'QUERY_BALANCES',
          'QUERY_SPENDING',
          'QUERY_BUDGETS',
          'QUERY_GOALS',
          'GENERAL_ASSISTANCE',
        ],
        description: 'The user intent you detected from their message',
      },
      content: {
        type: 'STRING',
        description: 'Your direct plain text response to the user in their requested locale',
      },
      proposal: {
        type: 'OBJECT',
        description: 'Transaction draft proposal if the user intended to record an expense or income and has write access',
        properties: {
          type: { type: 'STRING', enum: ['INCOME', 'EXPENSE'] },
          accountId: { type: 'STRING', description: 'Matching account UUID' },
          categoryId: { type: 'STRING', description: 'Matching category UUID' },
          amount: { type: 'STRING', description: 'Scaled amount string with 4 decimals e.g. 50000.0000' },
          currency: { type: 'STRING', description: '3-letter currency code matching the account' },
          description: { type: 'STRING', description: 'Short transaction description' },
          transactionDate: { type: 'STRING', description: 'ISO 8601 timestamp' },
        },
        required: ['type', 'accountId', 'categoryId', 'amount', 'currency', 'transactionDate'],
      },
    },
    required: ['content'],
  };

  const payload = {
    system_instruction: {
      parts: [{ text: context.systemInstructions }],
    },
    contents,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema,
    },
  };

  const modelsToTry = [primaryModel];
  if (fallbackModel !== primaryModel) {
    modelsToTry.push(fallbackModel);
  }

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const currentModel = modelsToTry[mIdx]!;
    const isPrimary = mIdx === 0;
    const maxRetries = isTest ? 0 : isPrimary ? 2 : 1;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0 && !isTest) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        await sleepWithJitter(backoffMs);
      }

      const timeoutMs = currentModel.includes('flash-lite') ? 15_000 : 25_000;
      const callResult = await callSingleModel(currentModel, config.apiKey, payload, timeoutMs);

      if (callResult.ok) {
        try {
          const cleaned = cleanJsonText(callResult.rawJsonText);
          const parsed = JSON.parse(cleaned);
          const validated = rawGeminiResponseSchema.safeParse(parsed);

          if (validated.success) {
            const data = validated.data;
            if (data.intent) {
              console.log(`[GeminiLlmProvider] AI detected intent: ${data.intent}`);
            }
            if (data.proposal && context.walletContext) {
              const account = context.walletContext.accounts.find((a) => a.id === data.proposal?.accountId);
              const category = context.walletContext.categories.find((c) => c.id === data.proposal?.categoryId);

              if (account && category && context.walletContext.canWrite) {
                const draftParse = aiTransactionDraftSchema.safeParse({
                  type: data.proposal.type,
                  ...(data.proposal.type === TransactionType.EXPENSE
                    ? { fromAccountId: account.id }
                    : { toAccountId: account.id }),
                  categoryId: category.id,
                  amount: formatMoney(parseMoney(data.proposal.amount)),
                  currency: account.currency,
                  description: (data.proposal.description ?? request.message).trim().slice(0, 200),
                  transactionDate: data.proposal.transactionDate || request.now.toISOString(),
                });

                if (draftParse.success) {
                  return {
                    content: data.content,
                    proposal: {
                      transaction: draftParse.data,
                      accountName: account.name,
                      categoryName: category.name,
                    },
                  };
                }
              }
            }

            return { content: data.content };
          } else {
            console.warn(`[GeminiLlmProvider] Response schema validation failed:`, validated.error.issues);
          }
        } catch (parseError) {
          console.warn(`[GeminiLlmProvider] Failed to parse model output:`, parseError);
        }
      } else {
        if (callResult.isClientError) {
          console.warn(`[GeminiLlmProvider] ${currentModel} returned HTTP 400 (Bad Request): ${callResult.errorText}. Skipping retries.`);
          break;
        }

        if (callResult.isRateLimit) {
          console.warn(`[GeminiLlmProvider] ${currentModel} returned HTTP 429 (Rate Limit / Quota Exceeded). Failing over to next model.`);
          break;
        }

        if (attempt < maxRetries) {
          console.warn(
            `[GeminiLlmProvider] ${currentModel} failed (attempt ${attempt + 1}/${maxRetries + 1}): ${callResult.errorText}. Retrying with backoff...`,
          );
        }
      }
    }
  }

  // All external models failed -> Fallback to deterministic mock
  if (fallback) {
    console.warn(`[GeminiLlmProvider] All models failed or unavailable. Falling back to deterministic mock.`);
    return fallback();
  }

  return {
    content: "I can record an expense or income (\"Spent 50k on lunch from Cash\"), and answer questions about your balances, this month's spending, budgets and goals.",
  };
}
