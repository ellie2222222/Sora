import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { RotateCw } from 'lucide-react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';

type AnimatedViewStyle = StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;

export interface PullToRefreshIndicatorProps {
  refreshing: boolean;
  spinnerVisible: boolean;
  onRefresh: () => void;
  indicatorAnimatedStyle: AnimatedViewStyle;
  iconAnimatedStyle: AnimatedViewStyle;
  spinnerAnimatedStyle: AnimatedViewStyle;
  testID?: string;
}

export function PullToRefreshIndicator({
  refreshing,
  spinnerVisible,
  onRefresh,
  indicatorAnimatedStyle,
  iconAnimatedStyle,
  spinnerAnimatedStyle,
  testID = 'pull-to-refresh-indicator',
}: PullToRefreshIndicatorProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceElevated,
          borderColor: theme.colors.border,
          pointerEvents: refreshing ? 'auto' : 'box-none',
          ...theme.shadows.md,
        },
        indicatorAnimatedStyle,
      ]}
      testID={testID}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.refresh', 'Refresh')}
        accessibilityHint={t('common.pullToRefreshHint', 'Double tap to refresh')}
        accessibilityState={{ busy: refreshing || spinnerVisible }}
        onPress={onRefresh}
        // The 36pt circle plus 4pt each side reaches the 44pt minimum touch target.
        hitSlop={4}
        className="w-full h-full items-center justify-center"
      >
        <Animated.View style={iconAnimatedStyle}>
          <RotateCw size={17} color={theme.colors.primary} strokeWidth={2.2} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, spinnerAnimatedStyle]} pointerEvents="none">
          {/* Never stopped: a stopped spinner hides itself, and starting it waits on a JS render. */}
          <ActivityIndicator size="small" color={theme.colors.primary} animating />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
