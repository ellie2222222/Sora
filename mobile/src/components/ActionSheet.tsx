import { View } from 'react-native';
import { Check } from 'lucide-react-native';

import { useTheme } from '@/app/providers';
import { BottomSheetModal } from './BottomSheetModal';
import { Text } from './Text';
import { ThemedIcon, ThemedPressable } from './Themed.tsx';

export interface ActionSheetAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /** Marks the current choice when the sheet picks one of several options. */
  selected?: boolean;
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
          <ThemedPressable
            // Labels are translated text and can coincide; the rows hold no state and never reorder while open.
            key={index}
            testID={action.testID}
            accessibilityRole="button"
            disabled={action.disabled}
            onPress={action.onPress}
            accessibilityState={action.selected === undefined ? undefined : { selected: action.selected }}
            className="flex-row items-center justify-between"
            style={{
              paddingVertical: theme.spacing.md,
              borderTopWidth: index === 0 ? 0 : theme.borderWidth.thin,
              borderTopColor: theme.colors.border,
            }}
          >
            <Text
              tone={action.destructive === true ? 'danger' : 'default'}
              weight={action.selected === true ? 'semibold' : 'medium'}
              style={action.disabled === true ? { color: theme.colors.buttonOutlineDisabledText } : undefined}
            >
              {action.label}
            </Text>
            {action.selected === true ? <ThemedIcon icon={Check} size={theme.iconSize.md} color={theme.colors.primary} /> : null}
          </ThemedPressable>
        ))}
      </View>
    </BottomSheetModal>
  );
}
