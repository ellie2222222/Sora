import { forwardRef, type ForwardedRef } from 'react';
import type { FlatList, FlatListProps } from 'react-native';
import Animated from 'react-native-reanimated';

import { PullToRefreshContainer } from './PullToRefreshContainer.tsx';
import { usePullToRefresh } from './usePullToRefresh.ts';

export interface RefreshableFlatListProps<ItemT> extends Omit<
  FlatListProps<ItemT>,
  // onScroll is the wrapper's UI-thread offset tracker; Reanimated's FlatList supplies its own cell renderer.
  'refreshing' | 'onRefresh' | 'onScroll' | 'CellRendererComponent'
> {
  refreshing: boolean;
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPullDistance?: number;
  indicatorTestID?: string;
}

function RefreshableFlatListInner<ItemT>(
  {
    refreshing,
    onRefresh,
    threshold,
    maxPullDistance,
    indicatorTestID,
    style,
    ...flatListProps
  }: RefreshableFlatListProps<ItemT>,
  ref: ForwardedRef<FlatList<ItemT>>
) {
  const ptr = usePullToRefresh({ refreshing, onRefresh, threshold, maxPullDistance });

  return (
    <PullToRefreshContainer ptr={ptr} refreshing={refreshing} style={style} indicatorTestID={indicatorTestID}>
      <Animated.FlatList
        ref={ref}
        scrollEventThrottle={16}
        onScroll={ptr.scrollHandler}
        // Overscroll would drag the content down with the pull; only the indicator may move.
        bounces={false}
        overScrollMode="never"
        {...flatListProps}
      />
    </PullToRefreshContainer>
  );
}

export const RefreshableFlatList = forwardRef(RefreshableFlatListInner) as <ItemT>(
  props: RefreshableFlatListProps<ItemT> & { ref?: ForwardedRef<FlatList<ItemT>> }
) => React.ReactElement;
