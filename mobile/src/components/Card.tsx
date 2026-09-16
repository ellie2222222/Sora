import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/app/providers';

export interface CardProps extends ViewProps {
  elevated?: boolean;
  padded?: boolean;
}

export function Card({ elevated = false, padded = true, style, ...props }: CardProps) {
  const theme = useTheme();

  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: elevated ? theme.colors.surfaceElevated : theme.colors.surface,
          borderRadius: theme.radius.lg,
          padding: padded ? theme.spacing.md : 0,
          ...(elevated ? theme.shadows.md : null),
        },
        style,
      ]}
    />
  );
}
