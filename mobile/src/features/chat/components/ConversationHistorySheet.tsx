import { useState } from 'react';
import { Trash2 } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AiConversationResponse } from '@sora/contracts';

import { BottomSheetModal, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { dayOfInstant, formatDay } from '@/utils';

export function ConversationHistorySheet({
  visible,
  conversations,
  activeConversationId,
  onClose,
  onOpen,
  onDelete,
}: {
  visible: boolean;
  conversations: AiConversationResponse[];
  activeConversationId: string | null;
  onClose: () => void;
  onOpen: (conversationId: string) => void;
  onDelete: (conversationId: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [pressedId, setPressedId] = useState<string | null>(null);

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('ai.history')} testID="sheet-ai-conversation">
      {conversations.length === 0 ? (
        <Text tone="muted" style={{ paddingVertical: theme.spacing.lg, textAlign: 'center' }}>
          {t('ai.noHistory')}
        </Text>
      ) : (
        <ScrollView testID="list-ai-conversations" style={{ maxHeight: 420 }}>
          {conversations.map((conversation) => {
            const active = conversation.id === activeConversationId;
            return (
              <View key={conversation.id} className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
                <Pressable
                  testID={`row-ai-conversation-${conversation.id}`}
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
                  <Text variant="caption" tone="faint">
                    {formatDay(dayOfInstant(conversation.updatedAt))}
                  </Text>
                </Pressable>
                <Pressable
                  testID={`btn-delete-ai-conversation-${conversation.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('ai.deleteChat')}
                  hitSlop={10}
                  onPress={() => onDelete(conversation.id)}
                >
                  <Trash2 size={18} color={theme.colors.textFaint} />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </BottomSheetModal>
  );
}
