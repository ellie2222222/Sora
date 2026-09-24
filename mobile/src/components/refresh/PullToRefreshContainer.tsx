import type { ReactElement } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import { PullToRefreshIndicator } from './PullToRefreshIndicator.tsx';
import type { usePullToRefresh } from './usePullToRefresh.ts';

export interface PullToRefreshContainerProps {
  ptr: ReturnType<typeof usePullToRefresh>;
  refreshing: boolean;
  style?: StyleProp<ViewStyle>;
  indicatorTestID?: string;
  /** The scrollable itself — the pull gesture attaches to it alongside its native scroll. */
  children: ReactElement;
}

/** Floats the indicator over the list — shared by every Refreshable* list. */
export function PullToRefreshContainer({ ptr, refreshing, style, indicatorTestID, children }: PullToRefreshContainerProps) {
  return (
    <View className="flex-1 overflow-hidden" style={style}>
      <GestureDetector gesture={ptr.gesture}>{children}</GestureDetector>
      <PullToRefreshIndicator
        refreshing={refreshing}
        spinnerVisible={ptr.spinnerVisible}
        onRefresh={ptr.triggerRefresh}
        indicatorAnimatedStyle={ptr.animatedIndicatorStyle}
        iconAnimatedStyle={ptr.animatedIconStyle}
        spinnerAnimatedStyle={ptr.animatedSpinnerStyle}
        testID={indicatorTestID}
      />
    </View>
  );
}
