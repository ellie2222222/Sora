import { Pressable, View } from 'react-native';

import { useTheme } from '@/app/providers';
import { BottomSheetModal } from './BottomSheetModal';
import { Text } from './Text';

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
  onCancel: () => void;
}

/** Shared bottom-sheet action list. */
export function ActionSheet({ visible, title, actions, onCancel }: ActionSheetProps) {
  const theme = useTheme();

  return (
    <BottomSheetModal visible={visible} onClose={onCancel} title={title ?? ''} closeLabel="cancel" entity="action-sheet">
      <View style={{ gap: theme.spacing.xs }}>
        {actions.map((action, index) => (
          <Pressable
            key={action.label}
            testID={action.testID}
            disabled={action.disabled}
            onPress={action.onPress}
            style={{
              paddingVertical: theme.spacing.md,
              borderTopWidth: index === 0 ? 0 : theme.borderWidth.thin,
              borderTopColor: theme.colors.border,
              opacity: action.disabled === true ? theme.opacity.disabled : 1,
            }}
          >
            <Text tone={action.destructive === true ? 'danger' : 'default'} weight="medium">
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </BottomSheetModal>
  );
}
