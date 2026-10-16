import {
  AI_REPLY_BUDGET_MS,
  ROUTES,
  apiUrl,
  type AiConversationResponse,
  type AiMessageResponse,
  type CreateAiConversationRequest,
  type SendAiMessageRequest,
  type SendAiMessageResponse,
} from '@sora/contracts';

import { getList, postOne, type ListResult, type PageQuery } from './client.ts';

/** Room on top of the API's own reply budget for the network and saving, so the app hears its error rather than timing out first. */
const AI_SEND_GRACE_MS = 10_000;

/** API spec §17. Signed-in only: the assistant reads server-side data, so guest mode has no counterpart. */
export const aiApi = {
  conversations(page: PageQuery): Promise<ListResult<AiConversationResponse>> {
    return getList<AiConversationResponse>(apiUrl(ROUTES.ai.conversations()), page);
  },

  createConversation(body: CreateAiConversationRequest): Promise<AiConversationResponse> {
    return postOne<AiConversationResponse>(apiUrl(ROUTES.ai.createConversation()), body);
  },

  deleteConversation(conversationId: string): Promise<AiConversationResponse> {
    return postOne<AiConversationResponse>(apiUrl(ROUTES.ai.deleteConversation(conversationId)));
  },

  /** Newest first. */
  messages(conversationId: string, page: PageQuery): Promise<ListResult<AiMessageResponse>> {
    return getList<AiMessageResponse>(apiUrl(ROUTES.ai.messages(conversationId)), page);
  },

  /** `requestId` goes out as `x-request-id`, the id the API logs every step of this reply under. */
  send(conversationId: string, body: SendAiMessageRequest, requestId?: string): Promise<SendAiMessageResponse> {
    return postOne<SendAiMessageResponse>(apiUrl(ROUTES.ai.sendMessage(conversationId)), body, {
      timeout: AI_REPLY_BUDGET_MS + AI_SEND_GRACE_MS,
      ...(requestId ? { headers: { 'x-request-id': requestId } } : {}),
    });
  },

  confirmAction(conversationId: string, messageId: string): Promise<AiMessageResponse> {
    return postOne<AiMessageResponse>(apiUrl(ROUTES.ai.confirmAction(conversationId, messageId)));
  },

  dismissAction(conversationId: string, messageId: string): Promise<AiMessageResponse> {
    return postOne<AiMessageResponse>(apiUrl(ROUTES.ai.dismissAction(conversationId, messageId)));
  },
};
