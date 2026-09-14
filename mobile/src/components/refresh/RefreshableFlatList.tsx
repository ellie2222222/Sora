import { forwardRef, type ForwardedRef } from 'react';
import {
  FlatList,
  View,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { PullToRefreshIndicator } from './PullToRefreshIndicator.tsx';
import { usePullToRefresh } from './usePullToRefresh.ts';

export interface RefreshableFlatListProps<ItemT> extends Omit<FlatListProps<ItemT>, 'refreshing' | 'onRefresh'> {
  refreshing: boolean;
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  indicatorTestID?: string;
}

function RefreshableFlatListInner<ItemT>(
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
    style,
    ...flatListProps
  }: RefreshableFlatListProps<ItemT>,
  ref: ForwardedRef<FlatList<ItemT>>
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
      <FlatList
        ref={ref}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        {...flatListProps}
      />
    </View>
  );
}

export const RefreshableFlatList = forwardRef(RefreshableFlatListInner) as <ItemT>(
  props: RefreshableFlatListProps<ItemT> & { ref?: ForwardedRef<FlatList<ItemT>> }
) => React.ReactElement;
