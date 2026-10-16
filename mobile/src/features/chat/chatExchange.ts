import type { ErrorCode, Locale } from '@sora/contracts';

// A direct path, not `@/utils`: node --test runs this file and has no alias.
import { isDeviceOnline } from '../../utils/deviceConnectivity.ts';
import { getServerErrorMessage, isApiError, isNetworkError, type TranslationFunction } from '../../utils/errors.ts';

/** Past this, the wait line says so honestly instead of repeating "preparing". */
export const SLOW_AFTER_MS = 10_000;

/**
 * Where one sent message is. `starting` creates the chat, `waiting` has the message with the API,
 * `slow` is `waiting` past SLOW_AFTER_MS, and `failed` keeps the text for a retry.
 */
export type ExchangeStage = 'starting' | 'waiting' | 'slow' | 'failed';

export interface ExchangeFailure {
  /** The line shown under the unsent message. */
  message: string;
  /** False when sending the same message again cannot succeed, so only Edit is offered. */
  retryable: boolean;
}

export interface PendingExchange {
  text: string;
  /** Kept with the text, so a retry is byte-for-byte the first request and reuses its Idempotency-Key. */
  walletId: string;
  locale: Locale;
  /** Set once the chat exists, so a retry goes to that chat rather than opening another one. */
  conversationId: string | null;
  stage: ExchangeStage;
  failure: ExchangeFailure | null;
  /** When this attempt began, so the "taking longer" line counts from the send, not from a re-render. */
  startedAt: number;
}

/** At most one exchange per chat; a chat not created yet is keyed NEW_CHAT until it has an id. */
export type PendingByChat = Readonly<Record<string, PendingExchange>>;
export const NEW_CHAT = 'new';

export function chatKey(conversationId: string | null): string {
  return conversationId ?? NEW_CHAT;
}

/** `next: null` clears the chat's exchange; every other chat's stays as it was. */
export function withExchange(all: PendingByChat, key: string, next: PendingExchange | null): PendingByChat {
  const { [key]: _replaced, ...rest } = all;
  return next === null ? rest : { ...rest, [key]: next };
}

export function startExchange(
  message: { text: string; walletId: string; locale: Locale },
  conversationId: string | null,
  now: number = Date.now(),
): PendingExchange {
  return {
    text: message.text,
    walletId: message.walletId,
    locale: message.locale,
    conversationId,
    stage: conversationId === null ? 'starting' : 'waiting',
    failure: null,
    startedAt: now,
  };
}

export function retryExchange(exchange: PendingExchange): PendingExchange {
  return startExchange(exchange, exchange.conversationId);
}

/** A per-attempt `x-request-id`, in the shape the API accepts, to find this attempt in its logs. */
export function newRequestId(): string {
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** True while a message is out and nothing should start another one. */
export function isInFlight(exchange: PendingExchange | null): boolean {
  return exchange !== null && exchange.stage !== 'failed';
}

/** Retrying any of these sends the same request into the same refusal. */
const PERMANENT: ReadonlySet<ErrorCode> = new Set([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'WALLET_NOT_FOUND',
  'AI_CONVERSATION_NOT_FOUND',
]);

const MESSAGE_KEY: Partial<Record<ErrorCode, string>> = {
  AI_PROVIDER_UNAVAILABLE: 'ai.failure.unavailable',
  AI_PROVIDER_BUSY: 'ai.failure.busy',
  AI_PROVIDER_TIMEOUT: 'ai.failure.timeout',
  IDEMPOTENCY_KEY_IN_USE: 'ai.failure.stillWorking',
  RATE_LIMITED: 'ai.failure.busy',
};

export function failureOf(error: unknown, t: TranslationFunction): ExchangeFailure {
  if (isNetworkError(error)) {
    const timedOut = isApiError(error) && /timeout|timed out/i.test(error.message);
    const unanswered = isDeviceOnline() ? 'ai.failure.unreachable' : 'ai.failure.offline';
    return { message: t(timedOut ? 'ai.failure.noAnswer' : unanswered), retryable: true };
  }
  const code = isApiError(error) ? error.code : null;
  if (code !== null && PERMANENT.has(code)) return { message: getServerErrorMessage(error, t), retryable: false };
  return { message: t((code !== null && MESSAGE_KEY[code]) || 'ai.failure.unavailable'), retryable: true };
}
