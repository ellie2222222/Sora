import { Modal, Pressable, View } from 'react-native';

import { useTheme } from '../app/providers/ThemeProvider.tsx';
import { Card } from './Card.tsx';
import { Text } from './Text.tsx';

export interface ActionSheetAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  testID?: string;
}

export interface ActionSheetProps {
  visible: boolean;
  title?: string;
  actions: ActionSheetAction[];
  cancelLabel?: string;
  onCancel: () => void;
}

/** Shared bottom-sheet action list, for a set of choices rather than ConfirmDialog's single confirm/cancel. */
export function ActionSheet({ visible, title, actions, cancelLabel = 'Cancel', onCancel }: ActionSheetProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onCancel}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Card elevated style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
              {title !== undefined ? (
                <Text variant="title" style={{ marginBottom: theme.spacing.sm }}>
                  {title}
                </Text>
              ) : null}
              {actions.map((action, index) => (
                <Pressable
                  key={action.label}
                  testID={action.testID}
                  disabled={action.disabled}
                  onPress={() => {
                    onCancel();
                    action.onPress();
                  }}
                  style={{
                    paddingVertical: theme.spacing.md,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: theme.colors.border,
                    opacity: action.disabled === true ? 0.5 : 1,
                  }}
                >
                  <Text tone={action.destructive === true ? 'danger' : 'default'} weight="medium">
                    {action.label}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                testID="action-sheet-cancel"
                onPress={onCancel}
                style={{
                  paddingVertical: theme.spacing.md,
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.border,
                  marginTop: theme.spacing.xs,
                }}
              >
                <Text tone="muted" weight="medium" style={{ textAlign: 'center' }}>
                  {cancelLabel}
                </Text>
              </Pressable>
            </Card>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
