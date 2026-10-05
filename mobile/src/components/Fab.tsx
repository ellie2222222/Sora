import { Plus } from 'lucide-react-native';
import { type PressableProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import type { Theme } from '@/design-system';
import { AnimatedPressable } from './AnimatedPressable';

export interface FabProps extends Omit<PressableProps, 'children' | 'style'> {
  size?: number;
  bottomOffset?: number;
  /** What the button creates, for screen readers; defaults to adding a transaction. */
  label?: string;
}

/** Bottom padding a list needs so its last row can scroll clear of the Fab. */
export function fabListPaddingBottom(theme: Theme, bottomOffset = 0): number {
  return bottomOffset + theme.sizes.fab + theme.spacing.md + theme.spacing.xl;
}

export function Fab({ size: sizeProp, bottomOffset = 0, label, testID = 'btn-add-transaction', ...pressableProps }: FabProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const size = sizeProp ?? theme.sizes.fab;

  return (
    <AnimatedPressable
      {...pressableProps}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label ?? t('home.addTransaction')}
      scaleTo={0.92}
      style={{
        position: 'absolute',
        right: theme.spacing.md,
        bottom: theme.spacing.md + bottomOffset,
        width: size,
        height: size,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.shadows.md,
      }}
    >
      <Plus size={size * 0.44} color={theme.colors.onPrimary} strokeWidth={theme.iconStroke.bold} />
    </AnimatedPressable>
  );
}
