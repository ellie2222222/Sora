import { Modal, Pressable, View } from 'react-native';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import { Button } from './Button.tsx';
import { Card } from './Card.tsx';
import { Text } from './Text.tsx';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Renders the confirm button as `danger` instead of `primary`, for an irreversible action. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Shared bottom-sheet confirmation, matching the modal pattern already used for the create-wallet sheet. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onCancel}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Card
              elevated
              style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, gap: theme.spacing.md }}
            >
              <Text variant="title">{title}</Text>
              {message !== undefined ? <Text tone="muted">{message}</Text> : null}
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <Button label={cancelLabel} variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
                <Button
                  label={confirmLabel}
                  variant={destructive ? 'danger' : 'primary'}
                  onPress={onConfirm}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
