import { useEffect, useMemo, useState } from 'react';
import { History, LogIn, MessageSquarePlus, Sparkles } from 'lucide-react-native';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AnimatedScreen, ListLoadMoreFooter, Skeleton, StateView, Text } from '@/components';
import { useAuth, useTheme, useToast, useWallets } from '@/app/providers';
import {
  useConfirmAiActionMutation,
  useCreateAiConversationMutation,
  useDeleteAiConversationMutation,
  useDismissAiActionMutation,
  useListAiConversationsQuery,
  useListAiMessagesInfiniteQuery,
  useSendAiMessageMutation,
} from '@/app/store';
import type { AiMessageResponse } from '@sora/contracts';
import { NoWalletState, WalletContextBar } from '@/features/wallets';
import { useNetworkStatus } from '@/hooks';
import { canLoadMore, flattenPages, getServerErrorMessage, isNetworkError } from '@/utils';
import { chatAvailability } from '../chatAvailability.ts';
import { ChatInputBar } from '../components/ChatInputBar.tsx';
import { ChatMessageItem } from '../components/ChatMessageItem.tsx';
import { ConversationHistorySheet } from '../components/ConversationHistorySheet.tsx';
import { SuggestedPromptChips } from '../components/SuggestedPromptChips.tsx';

const TITLE_LENGTH = 60;

/** The assistant tab. Guests get a sign-in prompt; offline, history stays readable and sending is off. */
export function AiChatScreen() {
  const { isGuest } = useAuth();

  return (
    <AnimatedScreen testID="screen-ai-chat">
      <WalletContextBar>{isGuest ? <GuestPrompt /> : <SignedInChat />}</WalletContextBar>
    </AnimatedScreen>
  );
}


function AssistantHeader({ rightElement }: { rightElement?: React.ReactNode }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View 
      className="flex-row items-center justify-between border-b"
      style={{ 
        paddingHorizontal: theme.spacing.md, 
        paddingVertical: theme.spacing.md,
        borderBottomColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
        <Sparkles size={20} color={theme.colors.primary} />
        <Text variant="title">{t('ai.title')}</Text>
      </View>
      {rightElement}
    </View>
  );
}

function GuestPrompt() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { exitGuestModeToAuth } = useAuth();
  
  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AssistantHeader />

      <View className="flex-1 justify-center" style={{ paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xl }}>
        <StateView
          variant="empty"
          icon={Sparkles}
          title={t('ai.guestTitle')}
          message={t('ai.guestMessage')}
          primaryAction={{ label: t('ai.signIn'), onPress: () => void exitGuestModeToAuth(), icon: LogIn }}
          testID="ai-guest"
          entrance="none"
        />
      </View>

      <ChatInputBar disabled={true} onSend={async () => false} />
    </KeyboardAvoidingView>
  );
}

function SignedInChat() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { isOnline } = useNetworkStatus();
  const { activeWalletId, permissions } = useWallets();

  const conversations = useListAiConversationsQuery();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasPickedInitial, setHasPickedInitial] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null);

  // Reopen the latest chat once, rather than every time the list refetches.
  useEffect(() => {
    if (hasPickedInitial || conversations.data === undefined) return;
    setConversationId(conversations.data[0]?.id ?? null);
    setHasPickedInitial(true);
  }, [conversations.data, hasPickedInitial]);

  const messages = useListAiMessagesInfiniteQuery(conversationId ?? '', { skip: conversationId === null });
  const [createConversation] = useCreateAiConversationMutation();
  const [sendMessage] = useSendAiMessageMutation();
  const [deleteConversation] = useDeleteAiConversationMutation();
  const [confirmAction] = useConfirmAiActionMutation();
  const [dismissAction] = useDismissAiActionMutation();
  const items = useMemo(() => flattenPages(messages.data?.pages) as AiMessageResponse[], [messages.data]);

  if (activeWalletId === null) return <NoWalletState testID="ai-no-wallet" />;

  const locale = i18n.language === 'vi' ? 'vi' : 'en';
  const isSending = pendingText !== null;
  const { canSend, blockedReason: blocked } = chatAvailability({ isOnline, isSending, canWrite: permissions.canWrite });

  /** Resolves false on failure so the input can give the text back. */
  const send = async (text: string): Promise<boolean> => {
    setPendingText(text);
    try {
      const targetId =
        conversationId ?? (await createConversation({ walletId: activeWalletId, title: text.slice(0, TITLE_LENGTH) }).unwrap()).id;
      await sendMessage({ conversationId: targetId, body: { walletId: activeWalletId, message: text, locale } }).unwrap();
      // Selected only now, so a new chat's first fetch already includes this exchange.
      setConversationId(targetId);
      return true;
    } catch (error) {
      showToast(isNetworkError(error) ? t('ai.offlineHint') : getServerErrorMessage(error, t), 'error');
      return false;
    } finally {
      setPendingText(null);
    }
  };

  const decide = async (messageId: string, decision: 'confirm' | 'dismiss') => {
    if (conversationId === null) return;
    setBusyMessageId(messageId);
    try {
      if (decision === 'confirm') {
        await confirmAction({ conversationId, messageId }).unwrap();
        showToast(t('ai.toast.recorded'), 'success');
      } else {
        await dismissAction({ conversationId, messageId }).unwrap();
      }
    } catch (error) {
      showToast(getServerErrorMessage(error, t), 'error');
      void messages.refetch();
    } finally {
      setBusyMessageId(null);
    }
  };

  const removeConversation = async (id: string) => {
    try {
      await deleteConversation(id).unwrap();
      if (id === conversationId) setConversationId(null);
    } catch (error) {
      showToast(getServerErrorMessage(error, t), 'error');
    }
  };

  const blockedReason = blocked === 'offline' ? t('ai.offlineHint') : blocked === 'viewOnly' ? t('ai.proposal.viewOnly') : null;
  const renderBody = () => {
    if (conversationId !== null && messages.isLoading) {
      return (
        <View style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, flex: 1, justifyContent: 'flex-end' }}>
          {[...Array(4)].map((_, i) => (
            <ChatMessageSkeleton key={i} fromUser={i % 2 === 0} />
          ))}
        </View>
      );
    }
    if (conversationId !== null && messages.isError && items.length === 0 && !isNetworkError(messages.error)) {
      return (
        <StateView
          variant="error"
          error={messages.error}
          retryAction={() => void messages.refetch()}
          testID="ai-messages-error"
          entrance="none"
        />
      );
    }
    if (items.length === 0 && !isSending) {
      return (
        <View className="flex-1 justify-center" style={{ gap: theme.spacing.lg, padding: theme.spacing.lg }}>
          <StateView variant="empty" icon={Sparkles} title={t('ai.emptyTitle')} message={t('ai.emptyMessage')} testID="ai-empty" entrance="none" />
          <SuggestedPromptChips disabled={!canSend} onPick={(prompt) => void send(prompt)} />
        </View>
      );
    }
    return (
      <FlatList
        testID="list-ai-messages"
        inverted
        data={items}
        keyExtractor={(message) => message.id}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm }}
        ListHeaderComponent={isSending ? <PendingExchange text={pendingText} /> : null}
        renderItem={({ item }) => (
          <ChatMessageItem
            message={item}
            blockedReason={blockedReason}
            busyMessageId={busyMessageId}
            onConfirm={(id) => void decide(id, 'confirm')}
            onDismiss={(id) => void decide(id, 'dismiss')}
          />
        )}
        onEndReached={() => {
          if (canLoadMore(messages)) void messages.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          <ListLoadMoreFooter
            isFetchingNextPage={messages.isFetchingNextPage}
            hasNextPage={messages.hasNextPage}
            isError={messages.isError}
            onRetry={() => void messages.fetchNextPage()}
            testID="ai-messages-list-footer"
          />
        }
      />
    );
  };

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AssistantHeader 
        rightElement={
          <View className="flex-row" style={{ gap: theme.spacing.md }}>
            <Pressable testID="btn-open-ai-history" accessibilityRole="button" accessibilityLabel={t('ai.history')} hitSlop={10} onPress={() => setHistoryOpen(true)}>
              <History size={20} color={theme.colors.textMuted} />
            </Pressable>
            <Pressable testID="btn-add-ai-conversation" accessibilityRole="button" accessibilityLabel={t('ai.newChat')} hitSlop={10} onPress={() => setConversationId(null)}>
              <MessageSquarePlus size={20} color={theme.colors.primary} />
            </Pressable>
          </View>
        }
      />

      <View className="flex-1">{renderBody()}</View>

      {!isOnline ? (
        <Text variant="caption" tone="muted" testID="ai-offline" style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
          {t('ai.offlineHint')}
        </Text>
      ) : null}
      <ChatInputBar disabled={!canSend} onSend={send} />

      <ConversationHistorySheet
        visible={historyOpen}
        conversations={conversations.data ?? []}
        activeConversationId={conversationId}
        onClose={() => setHistoryOpen(false)}
        onOpen={(id) => {
          setConversationId(id);
          setHistoryOpen(false);
        }}
        onDelete={(id) => void removeConversation(id)}
      />
    </KeyboardAvoidingView>
  );
}

/** The question just sent and a thinking line, shown until the answer replaces both. */
function PendingExchange({ text }: { text: string | null }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ gap: theme.spacing.xs, marginVertical: theme.spacing.xs }}>
      <View style={{ alignSelf: 'flex-end', maxWidth: '85%', padding: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.primary }}>
        <Text tone="onPrimary">{text}</Text>
      </View>
      <Text variant="caption" tone="faint" testID="ai-thinking">
        {t('ai.thinking')}
      </Text>
    </View>
  );
}

function ChatMessageSkeleton({ fromUser }: { fromUser: boolean }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: fromUser ? 'flex-end' : 'flex-start', marginVertical: theme.spacing.xs }}>
      <Skeleton width={fromUser ? 200 : 260} height={44} radius={theme.radius.lg} />
    </View>
  );
}
