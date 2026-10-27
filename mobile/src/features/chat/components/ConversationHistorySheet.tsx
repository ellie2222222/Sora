import { useState } from 'react';
import { Trash2 } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AiConversationResponse } from '@sora/contracts';

import {
  BottomSheetModal,
  closeOpenSwipeRow,
  ConfirmDialog,
  SkeletonList,
  StateView,
  SwipeableRow,
  Text,
  ThemedIcon,
  ThemedPressable,
} from '@/components';
import { useTheme } from '@/app/providers';
import { dayOfDate, formatDay } from '@/utils';

export function ConversationHistorySheet({
  visible,
  conversations,
  isLoading,
  error,
  onRetry,
  activeConversationId,
  onClose,
  onOpen,
  onDelete,
}: {
  visible: boolean;
  conversations: AiConversationResponse[];
  isLoading: boolean;
  /** Set only when the list failed and nothing is loaded, so an empty list is never shown in its place. */
  error: unknown;
  onRetry: () => void;
  activeConversationId: string | null;
  onClose: () => void;
  onOpen: (conversationId: string) => void;
  onDelete: (conversationId: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteSlop = (theme.sizes.touchTarget - theme.iconSize.lg) / 2;

  const renderBody = () => {
    if (isLoading) return <SkeletonList rows={4} />;
    if (error !== undefined) {
      return <StateView variant="error" error={error} retryAction={onRetry} testID="ai-conversations-error" entrance="none" />;
    }
    if (conversations.length === 0) {
      return (
        <Text tone="muted" style={{ paddingVertical: theme.spacing.lg, textAlign: 'center' }}>
          {t('ai.noHistory')}
        </Text>
      );
    }
    return (
      <FlatList
        testID="list-ai-conversations"
        data={conversations}
        keyExtractor={(conversation) => conversation.id}
        style={{ maxHeight: theme.sizes.listMaxHeight.lg }}
        onScrollBeginDrag={closeOpenSwipeRow}
        renderItem={({ item: conversation }) => {
          const active = conversation.id === activeConversationId;
          return (
            <SwipeableRow
              backgroundColor={theme.colors.surfaceElevated}
              radius={theme.radius.md}
              onActivate={() => onOpen(conversation.id)}
              actions={[
                { key: 'delete', label: t('common.delete'), icon: Trash2, tone: 'danger', onPress: () => setDeletingId(conversation.id), testID: 'btn-delete-ai-conversation' },
              ]}
            >
              <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
                <ThemedPressable
                  testID={`row-ai-conversation-${conversation.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => onOpen(conversation.id)}
                  onPressIn={() => setPressedId(conversation.id)}
                  onPressOut={() => setPressedId(null)}
                  style={{
                    flex: 1,
                    paddingVertical: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.sm,
                    borderRadius: theme.radius.md,
                    backgroundColor: active || pressedId === conversation.id ? theme.colors.surfaceMuted : 'transparent',
                  }}
                >
                  <Text weight={active ? 'semibold' : 'regular'} numberOfLines={1}>
                    {conversation.title}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {formatDay(dayOfDate(new Date(conversation.updatedAt)))}
                  </Text>
                </ThemedPressable>
                <Pressable
                  testID={`btn-delete-ai-conversation-${conversation.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('ai.deleteChat')}
                  hitSlop={deleteSlop}
                  onPress={() => setDeletingId(conversation.id)}
                >
                  <ThemedIcon icon={Trash2} size={theme.iconSize.lg} color={theme.colors.textFaint} />
                </Pressable>
              </View>
            </SwipeableRow>
          );
        }}
      />
    );
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('ai.history')} testID="sheet-ai-conversation">
      {renderBody()}
      <ConfirmDialog
        visible={deletingId !== null}
        title={t('ai.deleteChatTitle')}
        message={t('ai.deleteChatMessage')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => {
          const id = deletingId;
          setDeletingId(null);
          if (id !== null) onDelete(id);
        }}
        onCancel={() => setDeletingId(null)}
      />
    </BottomSheetModal>
  );
}
