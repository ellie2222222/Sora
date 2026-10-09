import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { useTheme } from '@/app/providers';
import { BottomSheetModal } from './BottomSheetModal';
import { Text } from './Text';

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
          <Pressable
            key={action.label}
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
              opacity: action.disabled === true ? theme.opacity.disabled : 1,
            }}
          >
            <Text tone={action.destructive === true ? 'danger' : 'default'} weight={action.selected === true ? 'semibold' : 'medium'}>
              {action.label}
            </Text>
            {action.selected === true ? <Check size={theme.iconSize.md} color={theme.colors.primary} /> : null}
          </Pressable>
        ))}
      </View>
    </BottomSheetModal>
  );
}
