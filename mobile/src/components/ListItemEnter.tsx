import type { ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

/**
 * Reanimated's declarative `entering` prop fires exactly once, on initial mount,
 * with no manual shared-value bookkeeping.
 */
const DEFAULT_ENTERING = FadeInDown.duration(280)
  .springify()
  .damping(18)
  .stiffness(220);

const DEFAULT_LAYOUT = Layout.springify().damping(18).stiffness(220);

export interface ListItemEnterProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Set to `false` to skip the entering animation (e.g. on initial load). */
  animate?: boolean;
  testID?: string;
}

/**
 * ```tsx
 * {items.map((item) => (
 *   <ListItemEnter key={item.id}>
 *     <ItemRow item={item} />
 *   </ListItemEnter>
 * ))}
 * ```
 */
export function ListItemEnter({
  children,
  style,
  animate = true,
  testID,
}: ListItemEnterProps) {
  return (
    <Animated.View
      testID={testID}
      entering={animate ? DEFAULT_ENTERING : undefined}
      layout={animate ? DEFAULT_LAYOUT : undefined}
      style={[{ width: '100%' }, style]}
    >
      {children}
    </Animated.View>
  );
}
