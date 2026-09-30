import {
  ROUTES,
  apiUrl,
  type AiConversationResponse,
  type AiMessageResponse,
  type CreateAiConversationRequest,
  type SendAiMessageRequest,
  type SendAiMessageResponse,
} from '@sora/contracts';

import { getList, postOne, type ListResult, type PageQuery } from './client.ts';

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

  send(conversationId: string, body: SendAiMessageRequest): Promise<SendAiMessageResponse> {
    return postOne<SendAiMessageResponse>(apiUrl(ROUTES.ai.sendMessage(conversationId)), body);
  },

  confirmAction(conversationId: string, messageId: string): Promise<AiMessageResponse> {
    return postOne<AiMessageResponse>(apiUrl(ROUTES.ai.confirmAction(conversationId, messageId)));
  },

  dismissAction(conversationId: string, messageId: string): Promise<AiMessageResponse> {
    return postOne<AiMessageResponse>(apiUrl(ROUTES.ai.dismissAction(conversationId, messageId)));
  },
};
