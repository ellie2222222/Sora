import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { Text } from './Text.tsx';

export interface SheetFormHeaderProps {
  title: string;
  onCancel: () => void;
  /** Names the testIDs: `sheet-<entity>` marks the open sheet, `btn-cancel-<entity>` its Cancel (NC-04). */
  entity: string;
}

/** Cancel + centred title for the keypad-driven create sheets, whose keypad carries the submit. */
export function SheetFormHeader({ title, onCancel, entity }: SheetFormHeaderProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const cancel = t('common.cancel', { defaultValue: 'Cancel' });

  return (
    <View testID={`sheet-${entity}`} className="flex-row items-center" style={{ flexShrink: 0, marginBottom: theme.spacing.xs }}>
      <Pressable
        testID={`btn-cancel-${entity}`}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={cancel}
        style={{ minWidth: theme.sizes.sheetHeaderAction, minHeight: theme.sizes.touchTarget, justifyContent: 'center' }}
      >
        <Text tone="muted">{cancel}</Text>
      </Pressable>
      <Text variant="title" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {title}
      </Text>
      {/* Mirrors the Cancel target's width so the title stays centred. */}
      <View style={{ width: theme.sizes.sheetHeaderAction }} />
    </View>
  );
}
