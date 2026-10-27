import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AiMessageRole, type AiMessageResponse } from '@sora/contracts';

import { Text, ThemedView } from '@/components';
import { useTheme } from '@/app/providers';
import { ActionProposalCard } from './ActionProposalCard.tsx';

const ENTERING = FadeInDown.duration(220);
/** Wide enough for a figure line, narrow enough that whose side a bubble is on stays obvious. */
export const BUBBLE_MAX_WIDTH = '85%';
const BULLET = '• ';

export function ChatMessageItem({
  message,
  animate = false,
  blockedReason,
  busyMessageId,
  onConfirm,
  onDismiss,
}: {
  message: AiMessageResponse;
  /** True only for a message that arrived while the chat was open, so scrolling history never replays it. */
  animate?: boolean;
  blockedReason: string | null;
  busyMessageId: string | null;
  onConfirm: (messageId: string) => void;
  onDismiss: (messageId: string) => void;
}) {
  const theme = useTheme();
  const fromUser = message.role === AiMessageRole.USER;

  return (
    <Animated.View
      testID={`row-ai-message-${message.id}`}
      entering={animate ? ENTERING : undefined}
      style={{ alignItems: fromUser ? 'flex-end' : 'flex-start', marginVertical: theme.spacing.xs }}
    >
      <ChatBubble fromUser={fromUser}>
        <MessageText text={message.content} fromUser={fromUser} />
      </ChatBubble>
      {message.action ? (
        <View style={{ maxWidth: BUBBLE_MAX_WIDTH, width: '100%' }}>
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
    </Animated.View>
  );
}

/** The user's words on the accent colour, the assistant's on a raised surface; the tail corner points to the speaker. */
export function ChatBubble({ fromUser, muted = false, children }: { fromUser: boolean; muted?: boolean; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <ThemedView
      style={{
        maxWidth: BUBBLE_MAX_WIDTH,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.lg,
        ...(fromUser ? { borderBottomRightRadius: theme.radius.xs } : { borderBottomLeftRadius: theme.radius.xs }),
        backgroundColor: fromUser ? (muted ? theme.colors.primaryMuted : theme.colors.primary) : theme.colors.surfaceElevated,
        borderWidth: theme.borderWidth.thin,
        borderColor: fromUser ? (muted ? theme.colors.border : theme.colors.primary) : theme.colors.border,
      }}
    >
      {children}
    </ThemedView>
  );
}

/** Lines kept as written; a "• " line gets a hanging indent so a wrapped item stays under its own text. */
export function MessageText({ text, fromUser, muted = false }: { text: string; fromUser: boolean; muted?: boolean }) {
  const theme = useTheme();
  const tone = fromUser && !muted ? 'onPrimary' : 'default';
  const blocks = text.split(/\n{2,}/);
  return (
    <View style={{ gap: theme.spacing.sm }}>
      {blocks.map((block, blockIndex) => (
        <View key={blockIndex} style={{ gap: theme.spacing.xxs }}>
          {block.split('\n').map((line, lineIndex) =>
            line.startsWith(BULLET) ? (
              <View key={lineIndex} className="flex-row" style={{ gap: theme.spacing.xs }}>
                <Text tone={tone} style={{ color: fromUser && !muted ? undefined : theme.colors.primary }}>
                  •
                </Text>
                <Text tone={tone} selectable style={{ flex: 1 }}>
                  {line.slice(BULLET.length)}
                </Text>
              </View>
            ) : (
              <Text key={lineIndex} tone={tone} selectable>
                {line}
              </Text>
            ),
          )}
        </View>
      ))}
    </View>
  );
}
