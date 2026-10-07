import { ChevronLeft } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { Text } from './Text.tsx';

export type SheetCloseLabel = 'cancel' | 'close';

export interface SheetHeaderProps {
  title: string;
  onClose: () => void;
  /** "Cancel" for a sheet that discards what was entered, "Close" for one that only shows or picks. */
  closeLabel: SheetCloseLabel;
  /** Shown only when there is somewhere to go back to: a sheet opened from another, or an earlier step. */
  onBack?: () => void;
  /** Names the testIDs: `sheet-<entity>`, `btn-back-<entity>`, `btn-cancel-<entity>` (NC-04). */
  entity?: string;
}

/** Back on the left, the title centred, Cancel/Close on the right — the one header every sheet uses. */
export function SheetHeader({ title, onClose, closeLabel, onBack, entity }: SheetHeaderProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const close = closeLabel === 'cancel' ? t('common.cancel') : t('common.close');
  const back = t('common.back');
  const action = { width: theme.sizes.sheetHeaderAction, minHeight: theme.sizes.touchTarget, justifyContent: 'center' as const };

  return (
    <View
      testID={entity === undefined ? undefined : `sheet-${entity}`}
      className="flex-row items-center"
      style={{ flexShrink: 0, marginBottom: theme.spacing.sm }}
    >
      <View style={action}>
        {onBack !== undefined ? (
          <Pressable
            testID={entity === undefined ? undefined : `btn-back-${entity}`}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={back}
            hitSlop={theme.sizes.hitSlop.md}
            style={{ alignSelf: 'flex-start' }}
          >
            <ChevronLeft size={theme.iconSize.xl} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <Text variant="title" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {title}
      </Text>
      <Pressable
        testID={entity === undefined ? undefined : `btn-cancel-${entity}`}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={close}
        style={{ ...action, alignItems: 'flex-end' }}
      >
        <Text tone="muted" numberOfLines={1}>
          {close}
        </Text>
      </Pressable>
    </View>
  );
}
