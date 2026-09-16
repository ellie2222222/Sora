import { Plus } from 'lucide-react-native';
import { type PressableProps } from 'react-native';

import { useTheme } from '@/app/providers';
import { AnimatedPressable } from './AnimatedPressable';

export interface FabProps extends Omit<PressableProps, 'children' | 'style'> {
  size?: number;
  bottomOffset?: number;
}

export function Fab({ size = 48, bottomOffset = 0, testID = 'fab-add-transaction', ...pressableProps }: FabProps) {
  const theme = useTheme();

  return (
    <AnimatedPressable
      {...pressableProps}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Add transaction"
      scaleTo={0.92}
      style={{
        position: 'absolute',
        right: theme.spacing.md,
        bottom: theme.spacing.md + bottomOffset,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...theme.shadows.md,
      }}
    >
      <Plus size={size * 0.44} color={theme.colors.onPrimary} strokeWidth={2.5} />
    </AnimatedPressable>
  );
}

