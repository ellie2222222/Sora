import { forwardRef } from 'react';
import type { ScrollView, ScrollViewProps } from 'react-native';
import Animated from 'react-native-reanimated';

import { PullToRefreshContainer } from './PullToRefreshContainer.tsx';
import { usePullToRefresh } from './usePullToRefresh.ts';

export interface RefreshableScrollViewProps extends Omit<ScrollViewProps, 'onScroll'> {
  // onScroll is omitted: the wrapper owns it, as a UI-thread handler that tracks the offset for the pull.
  refreshing: boolean;
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPullDistance?: number;
  indicatorTestID?: string;
}

export const RefreshableScrollView = forwardRef<ScrollView, RefreshableScrollViewProps>(
  function RefreshableScrollView(
    { children, refreshing, onRefresh, threshold, maxPullDistance, indicatorTestID, style, ...scrollViewProps },
    ref
  ) {
    const ptr = usePullToRefresh({ refreshing, onRefresh, threshold, maxPullDistance });

    return (
      <PullToRefreshContainer ptr={ptr} refreshing={refreshing} style={style} indicatorTestID={indicatorTestID}>
        <Animated.ScrollView
          ref={ref}
          scrollEventThrottle={16}
          onScroll={ptr.scrollHandler}
          // Overscroll would drag the content down with the pull; only the indicator may move.
          bounces={false}
          overScrollMode="never"
          {...scrollViewProps}
        >
          {children}
        </Animated.ScrollView>
      </PullToRefreshContainer>
    );
  }
);
