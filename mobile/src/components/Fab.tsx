import { Plus } from 'lucide-react-native';
import { Pressable, type PressableProps } from 'react-native';

import { useTheme } from '../app/providers/ThemeProvider.tsx';

export interface FabProps extends Omit<PressableProps, 'children'> {
  size?: number;
}

/** The floating add-transaction button. Positioning above the tab bar is the caller's job. */
export function Fab({ size = 56, style, testID = 'fab-add-transaction', ...pressableProps }: FabProps) {
  const theme = useTheme();

  return (
    <Pressable
      {...pressableProps}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Add transaction"
      style={(state) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: state.pressed ? 0.85 : 1,
          ...theme.shadows.lg,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      <Plus size={size * 0.46} color={theme.colors.onPrimary} strokeWidth={2.5} />
    </Pressable>
  );
}
