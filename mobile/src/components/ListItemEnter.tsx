import type { ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

/**
 * Default entering animation: fade in + slight slide-down.
 *
 * The new item appears to physically enter the list, while existing items
 * smoothly reposition via the `Layout` transition.
 *
 * Uses Reanimated's declarative `entering` / `layout` props so the
 * animation fires exactly once — on initial mount — with zero manual
 * shared-value bookkeeping.
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
 * Wraps a list-row so newly-inserted items fade + scale + slide in while
 * existing siblings smoothly make room via a layout transition.
 *
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
