import { forwardRef } from 'react';
import {
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';

import { PullToRefreshIndicator } from './PullToRefreshIndicator.tsx';
import { usePullToRefresh } from './usePullToRefresh.ts';

export interface RefreshableScrollViewProps extends ScrollViewProps {
  refreshing: boolean;
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  indicatorTestID?: string;
}

export const RefreshableScrollView = forwardRef<ScrollView, RefreshableScrollViewProps>(
  function RefreshableScrollView(
    {
      refreshing,
      onRefresh,
      threshold,
      onScroll,
      onScrollEndDrag,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      indicatorTestID,
      children,
      style,
      ...scrollViewProps
    },
    ref
  ) {
    const ptr = usePullToRefresh({
      refreshing,
      onRefresh,
      threshold,
    });

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      ptr.handleScroll(event);
      onScroll?.(event);
    };

    const handleScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      ptr.handleScrollEndDrag(event);
      onScrollEndDrag?.(event);
    };

    const handleTouchStart = (e: any) => {
      ptr.handleTouchStart(e);
      onTouchStart?.(e);
    };

    const handleTouchMove = (e: any) => {
      ptr.handleTouchMove(e);
      onTouchMove?.(e);
    };

    const handleTouchEnd = (e: any) => {
      ptr.handleTouchEnd();
      onTouchEnd?.(e);
    };

    return (
      <View
        style={[{ flex: 1, overflow: 'hidden' }, style]}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <PullToRefreshIndicator
          refreshing={refreshing}
          onRefresh={ptr.triggerRefresh}
          indicatorAnimatedStyle={ptr.animatedIndicatorStyle}
          iconAnimatedStyle={ptr.animatedIconStyle}
          testID={indicatorTestID}
        />
        <ScrollView
          ref={ref}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onScrollEndDrag={handleScrollEndDrag}
          {...scrollViewProps}
        >
          {children}
        </ScrollView>
      </View>
    );
  }
);
