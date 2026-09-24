import { forwardRef, type ForwardedRef, type ReactElement } from 'react';
import { SectionList, type DefaultSectionT, type SectionListProps } from 'react-native';
import Animated, { type AnimatedProps } from 'react-native-reanimated';

import { PullToRefreshContainer } from './PullToRefreshContainer.tsx';
import { usePullToRefresh } from './usePullToRefresh.ts';

// Reanimated ships no animated SectionList, and createAnimatedComponent drops its item/section generics.
const AnimatedSectionList = Animated.createAnimatedComponent(SectionList) as unknown as <ItemT, SectionT>(
  props: AnimatedProps<SectionListProps<ItemT, SectionT>> & { ref?: ForwardedRef<SectionList<ItemT, SectionT>> }
) => ReactElement;

export interface RefreshableSectionListProps<ItemT, SectionT = DefaultSectionT>
  extends Omit<
    SectionListProps<ItemT, SectionT>,
    // onScroll is the wrapper's UI-thread offset tracker.
    'refreshing' | 'onRefresh' | 'onScroll'
  > {
  refreshing: boolean;
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPullDistance?: number;
  indicatorTestID?: string;
}

function RefreshableSectionListInner<ItemT, SectionT = DefaultSectionT>(
  {
    refreshing,
    onRefresh,
    threshold,
    maxPullDistance,
    indicatorTestID,
    style,
    ...sectionListProps
  }: RefreshableSectionListProps<ItemT, SectionT>,
  ref: ForwardedRef<SectionList<ItemT, SectionT>>
) {
  const ptr = usePullToRefresh({ refreshing, onRefresh, threshold, maxPullDistance });

  return (
    <PullToRefreshContainer ptr={ptr} refreshing={refreshing} style={style} indicatorTestID={indicatorTestID}>
      <AnimatedSectionList
        ref={ref}
        scrollEventThrottle={16}
        onScroll={ptr.scrollHandler}
        // Overscroll would drag the content down with the pull; only the indicator may move.
        bounces={false}
        overScrollMode="never"
        {...sectionListProps}
      />
    </PullToRefreshContainer>
  );
}

export const RefreshableSectionList = forwardRef(RefreshableSectionListInner) as <ItemT, SectionT = DefaultSectionT>(
  props: RefreshableSectionListProps<ItemT, SectionT> & { ref?: ForwardedRef<SectionList<ItemT, SectionT>> }
) => React.ReactElement;
