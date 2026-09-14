import { forwardRef, type ForwardedRef } from 'react';
import {
  SectionList,
  View,
  type DefaultSectionT,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type SectionListProps,
} from 'react-native';

import { PullToRefreshIndicator } from './PullToRefreshIndicator.tsx';
import { usePullToRefresh } from './usePullToRefresh.ts';

export interface RefreshableSectionListProps<ItemT, SectionT = DefaultSectionT>
  extends Omit<SectionListProps<ItemT, SectionT>, 'refreshing' | 'onRefresh'> {
  refreshing: boolean;
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  indicatorTestID?: string;
}

function RefreshableSectionListInner<ItemT, SectionT = DefaultSectionT>(
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
    ...sectionListProps
  }: RefreshableSectionListProps<ItemT, SectionT>,
  ref: ForwardedRef<SectionList<ItemT, SectionT>>
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
      <SectionList
        ref={ref}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        {...sectionListProps}
      />
    </View>
  );
}

export const RefreshableSectionList = forwardRef(RefreshableSectionListInner) as <ItemT, SectionT = DefaultSectionT>(
  props: RefreshableSectionListProps<ItemT, SectionT> & { ref?: ForwardedRef<SectionList<ItemT, SectionT>> }
) => React.ReactElement;
