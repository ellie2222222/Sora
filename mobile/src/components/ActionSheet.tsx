import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

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
  cancelLabel?: string;
  onCancel: () => void;
}

/** Shared bottom-sheet action list. */
export function ActionSheet({ visible, title, actions, cancelLabel, onCancel }: ActionSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const resolvedCancelLabel = cancelLabel ?? t('common.cancel');

  return (
    <BottomSheetModal visible={visible} onClose={onCancel} title={title}>
      <View style={{ gap: theme.spacing.xs }}>
        {actions.map((action, index) => (
          <Pressable
            key={action.label}
            testID={action.testID}
            disabled={action.disabled}
            onPress={action.onPress}
            style={{
              paddingVertical: theme.spacing.md,
              borderTopWidth: index === 0 && title === undefined ? 0 : 1,
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
          className="border-t"
          style={{
            paddingVertical: theme.spacing.md,
            borderTopColor: theme.colors.border,
            marginTop: theme.spacing.xs,
          }}
        >
          <Text tone="muted" weight="medium" style={{ textAlign: 'center' }}>
            {resolvedCancelLabel}
          </Text>
        </Pressable>
      </View>
    </BottomSheetModal>
  );
}
