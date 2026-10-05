import type { AiConversationResponse, AiMessageResponse, SendAiMessageRequest, SendAiMessageResponse } from '@sora/contracts';

import { aiApi as aiHttp, type ListResult } from '@/services/api';
import { cacheKeyOf } from '@/services/sync';
import { FIRST_PAGE, nextPageParam } from '@/utils';
import { apiSlice, toQueryFnResult } from './apiSlice.ts';
import { readSignedInCached } from './guestFallback.ts';

/** The most recent messages a chat shows; the API pages further back (§17.4). */
const MESSAGE_PAGE_SIZE = 100;
const CONVERSATION_PAGE_SIZE = 50;

/** A confirmed proposal is a real transaction, so everything derived from the ledger refetches. */
const LEDGER_TAGS = ['Transaction', 'Account', 'Dashboard', 'Budget', 'Wallet', 'Goal'] as const;

export const aiApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listAiConversations: builder.query<AiConversationResponse[], void>({
      queryFn: (_arg, { endpoint }) =>
        toQueryFnResult(() =>
          readSignedInCached(
            cacheKeyOf(endpoint, undefined),
            async () => (await aiHttp.conversations({ page: 1, pageSize: CONVERSATION_PAGE_SIZE })).items,
          ),
        ),
      providesTags: ['AiConversation'],
    }),
    /** Newest first, matching an inverted list. Saved per account so history stays readable offline. */
    listAiMessages: builder.infiniteQuery<
      ListResult<AiMessageResponse>,
      string,
      number
    >({
      infiniteQueryOptions: {
        initialPageParam: FIRST_PAGE,
        getNextPageParam: (lastPage) => nextPageParam(lastPage),
      },
      queryFn: ({ queryArg: conversationId, pageParam }, { endpoint }) =>
        toQueryFnResult(() =>
          readSignedInCached(
            cacheKeyOf(endpoint, conversationId, pageParam),
            async () =>
              (await aiHttp.messages(conversationId, { page: pageParam, pageSize: MESSAGE_PAGE_SIZE })) as ListResult<AiMessageResponse>,
          ),
        ),
      providesTags: (_result, _error, conversationId) => [{ type: 'AiMessage', id: conversationId }],
    }),
    createAiConversation: builder.mutation<AiConversationResponse, { walletId: string; title: string }>({
      queryFn: (body) => toQueryFnResult(() => aiHttp.createConversation(body)),
      invalidatesTags: ['AiConversation'],
    }),
    deleteAiConversation: builder.mutation<AiConversationResponse, string>({
      queryFn: (conversationId) => toQueryFnResult(() => aiHttp.deleteConversation(conversationId)),
      invalidatesTags: ['AiConversation'],
    }),
    sendAiMessage: builder.mutation<SendAiMessageResponse, { conversationId: string; body: SendAiMessageRequest }>({
      queryFn: ({ conversationId, body }) => toQueryFnResult(() => aiHttp.send(conversationId, body)),
      onQueryStarted: async ({ conversationId }, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            aiApiSlice.util.updateQueryData('listAiMessages', conversationId, (draft) => {
              draft.pages[0]?.items.unshift(data.assistantMessage, data.userMessage);
            }),
          );
        } catch {
          // Nothing was added to the cache.
        }
      },
      invalidatesTags: ['AiConversation'],
    }),
    confirmAiAction: builder.mutation<AiMessageResponse, { conversationId: string; messageId: string }>({
      queryFn: ({ conversationId, messageId }) => toQueryFnResult(() => aiHttp.confirmAction(conversationId, messageId)),
      onQueryStarted: ({ conversationId }, lifecycle) => replaceMessage(conversationId, lifecycle),
      invalidatesTags: (result) => (result ? [...LEDGER_TAGS] : []),
    }),
    dismissAiAction: builder.mutation<AiMessageResponse, { conversationId: string; messageId: string }>({
      queryFn: ({ conversationId, messageId }) => toQueryFnResult(() => aiHttp.dismissAction(conversationId, messageId)),
      onQueryStarted: ({ conversationId }, lifecycle) => replaceMessage(conversationId, lifecycle),
    }),
  }),
  overrideExisting: __DEV__,
});

async function replaceMessage(
  conversationId: string,
  { dispatch, queryFulfilled }: { dispatch: (action: unknown) => unknown; queryFulfilled: Promise<{ data: AiMessageResponse }> },
): Promise<void> {
  try {
    const { data } = await queryFulfilled;
    dispatch(
      aiApiSlice.util.updateQueryData('listAiMessages', conversationId, (draft) => {
        for (const page of draft.pages) {
          const index = page.items.findIndex((message: AiMessageResponse) => message.id === data.id);
          if (index >= 0) {
            page.items[index] = data;
            break;
          }
        }
      }),
    );
  } catch {
    // A 409 means the card is stale; the chat's refetch shows its real state.
  }
}

export const {
  useListAiConversationsQuery,
  useListAiMessagesInfiniteQuery,
  useCreateAiConversationMutation,
  useDeleteAiConversationMutation,
  useSendAiMessageMutation,
  useConfirmAiActionMutation,
  useDismissAiActionMutation,
} = aiApiSlice;
