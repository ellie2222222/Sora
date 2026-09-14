import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { RotateCw } from 'lucide-react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../app/providers/ThemeProvider.tsx';

export interface PullToRefreshIndicatorProps {
  refreshing: boolean;
  onRefresh: () => void;
  indicatorAnimatedStyle: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  iconAnimatedStyle: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>;
  testID?: string;
}

export function PullToRefreshIndicator({
  refreshing,
  onRefresh,
  indicatorAnimatedStyle,
  iconAnimatedStyle,
  testID = 'pull-to-refresh-indicator',
}: PullToRefreshIndicatorProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Animated.View
      pointerEvents={refreshing ? 'auto' : 'box-none'}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surfaceElevated,
          borderColor: theme.colors.border,
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
        accessibilityState={{ busy: refreshing }}
        onPress={onRefresh}
        style={styles.pressable}
      >
        <Animated.View style={iconAnimatedStyle}>
          <RotateCw size={17} color={theme.colors.primary} strokeWidth={2.2} />
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
  pressable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
