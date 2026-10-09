import { View } from 'react-native';
import { AiMessageRole, type AiMessageResponse } from '@sora/contracts';

import { Text } from '@/components';
import { useTheme } from '@/app/providers';
import { ActionProposalCard } from './ActionProposalCard.tsx';

export function ChatMessageItem({
  message,
  blockedReason,
  busyMessageId,
  onConfirm,
  onDismiss,
}: {
  message: AiMessageResponse;
  blockedReason: string | null;
  busyMessageId: string | null;
  onConfirm: (messageId: string) => void;
  onDismiss: (messageId: string) => void;
}) {
  const theme = useTheme();
  const fromUser = message.role === AiMessageRole.USER;

  return (
    <View
      testID={`row-ai-message-${message.id}`}
      style={{ alignItems: fromUser ? 'flex-end' : 'flex-start', marginVertical: theme.spacing.sm }}
    >
      <View
        style={{
          maxWidth: '85%',
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.lg,
          backgroundColor: fromUser ? theme.colors.primary : theme.colors.surfaceMuted,
        }}
      >
        <Text tone={fromUser ? 'onPrimary' : 'default'}>{message.content}</Text>
      </View>
      {message.action ? (
        <View style={{ maxWidth: '85%' }}>
          <ActionProposalCard
            messageId={message.id}
            action={message.action}
            blockedReason={blockedReason}
            isBusy={busyMessageId === message.id}
            onConfirm={() => onConfirm(message.id)}
            onDismiss={() => onDismiss(message.id)}
          />
        </View>
      ) : null}
    </View>
  );
}
