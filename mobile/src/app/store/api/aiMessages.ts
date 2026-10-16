import type { AiMessageResponse, SendAiMessageResponse } from '@sora/contracts';

/**
 * Puts a sent exchange at the top of a newest-first page, once. A retry whose first attempt did
 * land replays the same rows under the same Idempotency-Key; adding them again would show them twice.
 */
export function prependExchange(page: { items: AiMessageResponse[] } | undefined, sent: SendAiMessageResponse): void {
  if (!page || page.items.some((message) => message.id === sent.userMessage.id)) return;
  page.items.unshift(sent.assistantMessage, sent.userMessage);
}
