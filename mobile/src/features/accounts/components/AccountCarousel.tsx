import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import type { AccountResponse } from '@sora/contracts';

import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Skeleton, Text, ThemedView } from '@/components';
import { useTheme } from '@/app/providers';

import { ACCOUNT_CARD_SKINS, BACKLIGHT, type AccountCardSkin, type Theme } from '@/design-system';
import { assignCardSkins } from '../cardSkins.ts';
import { DECK, deckFadeEnd, deckFrontIndex, deckLayer, deckLoops, deckOffset, deckPose, deckSnapIndex, deckTargetFor } from '../carouselLayout.ts';
import { AccountCard, accountCardRadius } from './AccountCard.tsx';

const SNAP_SPRING = { damping: 20, stiffness: 180, mass: 0.8 } as const;
/** A drag starts only once it is clearly sideways, so the screen's own vertical scroll still works. */
const PAN_ACTIVATE_PX = 12;
/** How far past the first or last card a drag may pull, in cards, before it resists. */
const EDGE_PULL = 0.3;

/**
 * A wallet's accounts as a swipeable deck. A screen reader steps through it with increment and decrement;
 * with Reduce Motion the cards stay flat and snap.
 */
export function AccountCarousel({ accounts, onOpenAccount }: { accounts: AccountResponse[]; onOpenAccount: (accountId: string) => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [containerWidth, setContainerWidth] = useState(0);
  // The card in front once a drag or tap settles: set on release, never mid-drag, so a swipe re-renders nothing.
  const [page, setPage] = useState(0);
  // Which cards stay mounted; moved once the snap has finished, so mounting never lands inside an animation.
  const [windowCenter, setWindowCenter] = useState(0);
  const position = useSharedValue(0);
  const dragStart = useSharedValue(0);

  const count = accounts.length;
  const skinIndex = useMemo(() => assignCardSkins(accounts, ACCOUNT_CARD_SKINS.length), [accounts]);
  const skinOf = useCallback((accountId: string): AccountCardSkin => ACCOUNT_CARD_SKINS[skinIndex.get(accountId) ?? 0]!, [skinIndex]);
  const { cardWidth, cardHeight, glowRoom } = deckGeometry(containerWidth, count, theme);
  const lastIndex = Math.max(count - 1, 0);

  // The front card is an account, not a slot: one added before it (an offline create goes first) or archived
  // keeps the same account in front, or the nearest one left if it was the front card that went.
  const frontId = useRef<string | null>(null);
  const seenAccounts = useRef(accounts);
  useEffect(() => {
    if (seenAccounts.current !== accounts) {
      seenAccounts.current = accounts;
      const kept = frontId.current === null ? -1 : accounts.findIndex((account) => account.id === frontId.current);
      const target = kept >= 0 ? kept : Math.min(page, lastIndex);
      if (target !== page) {
        position.value = target;
        setPage(target);
        setWindowCenter(target);
        return;
      }
    }
    frontId.current = accounts[page]?.id ?? null;
  }, [accounts, page, lastIndex, position]);

  const settleOn = useCallback(
    (target: number) => {
      'worklet';
      const front = deckFrontIndex(target, count);
      const onSettled = (finished?: boolean) => {
        'worklet';
        if (finished) runOnJS(setWindowCenter)(front);
      };
      position.value = reduceMotion ? withTiming(target, { duration: 0 }, onSettled) : withSpring(target, SNAP_SPRING, onSettled);
      runOnJS(setPage)(front);
    },
    [position, reduceMotion, count],
  );

  const goTo = useCallback((index: number) => settleOn(deckTargetFor(index, position.value, count)), [position, count, settleOn]);

  const pan = Gesture.Pan()
    .enabled(count > 1)
    .activeOffsetX([-PAN_ACTIVATE_PX, PAN_ACTIVATE_PX])
    .failOffsetY([-PAN_ACTIVATE_PX, PAN_ACTIVATE_PX])
    .onBegin(() => {
      dragStart.value = position.value;
    })
    .onUpdate((event) => {
      if (cardWidth <= 0) return;
      const dragged = dragStart.value - event.translationX / cardWidth;
      position.value = deckLoops(count) ? dragged : Math.max(-EDGE_PULL, Math.min(lastIndex + EDGE_PULL, dragged));
    })
    .onEnd((event) => {
      settleOn(deckSnapIndex(position.value, Math.round(dragStart.value), event.velocityX, cardWidth, count));
    });

  const shown = Math.min(page, lastIndex);
  // Read at tap time, so the handler keeps one identity and the memoised cards don't re-render on every page.
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const openAccountRef = useRef(onOpenAccount);
  openAccountRef.current = onOpenAccount;
  const handleCardPress = useCallback(
    (index: number, accountId: string) => (index === shownRef.current ? openAccountRef.current(accountId) : goTo(index)),
    [goTo],
  );

  return (
    <View onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)} style={{ gap: theme.spacing.sm }}>
      {containerWidth > 0 ? (
        <GestureDetector gesture={pan}>
          <View
            testID="list-accounts"
            accessible={count > 1}
            accessibilityRole="adjustable"
            accessibilityLabel={t('accounts.cardPosition', { position: shown + 1, total: count })}
            accessibilityValue={{ text: accounts[shown]?.name }}
            // Grouped, the cards are not reachable one by one, so the deck itself opens the account in front.
            accessibilityActions={[{ name: 'activate' }, { name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event) => {
              const { actionName } = event.nativeEvent;
              const front = accounts[shown];
              if (actionName === 'activate') {
                if (front !== undefined) onOpenAccount(front.id);
              } else goTo(shown + (actionName === 'increment' ? 1 : -1));
            }}
            style={{ height: cardHeight + glowRoom * 2 }}
          >
            {accounts.map((account, index) =>
              Math.abs(deckOffset(index, Math.min(windowCenter, lastIndex), count)) <= DECK.mountedRange ? (
                <DeckCard
                  key={account.id}
                  account={account}
                  skin={skinOf(account.id)}
                  index={index}
                  count={count}
                  position={position}
                  width={cardWidth}
                  height={cardHeight}
                  left={(containerWidth - cardWidth) / 2}
                  top={glowRoom}
                  flat={reduceMotion || count === 1}
                  onPress={handleCardPress}
                />
              ) : null,
            )}
          </View>
        </GestureDetector>
      ) : null}

      {count > 1 && containerWidth > 0 ? (
        <View style={{ marginTop: -theme.spacing.huge }}>
          <DeckNames accounts={accounts} skinOf={skinOf} position={position} width={containerWidth} shown={shown} onSelect={goTo} />
        </View>
      ) : null}
    </View>
  );
}

function deckGeometry(containerWidth: number, count: number, theme: Theme) {
  const cardWidth = count > 1 ? containerWidth * DECK.cardShare : containerWidth;
  const cardHeight = cardWidth / theme.sizes.accountCard.aspectRatio;
  // The deck's own box clips what spills past it, so it leaves the glow's full reach, plus the drop shadow's offset;
  // the names row then rises into the faded lower band.
  const glowRoom = cardHeight * BACKLIGHT.spreadY + theme.spacing.sm;
  return { cardWidth, cardHeight, glowRoom };
}

/** The deck's footprint while accounts load: a card where the front one will sit, and room for the names under it. */
export function AccountCarouselSkeleton() {
  const theme = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const { cardWidth, cardHeight, glowRoom } = deckGeometry(containerWidth, 2, theme);

  return (
    <View onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)} style={{ gap: theme.spacing.sm }}>
      <View className="items-center justify-center" style={{ height: cardHeight + glowRoom * 2 }}>
        {containerWidth > 0 ? <Skeleton width={cardWidth} height={cardHeight} radius={theme.radius.xl} /> : null}
      </View>
      <View style={{ height: theme.sizes.touchTarget, marginTop: -theme.spacing.huge }} />
    </View>
  );
}

const DeckCard = memo(function DeckCard({
  account,
  skin,
  index,
  count,
  position,
  width,
  height,
  left,
  top,
  flat,
  onPress,
}: {
  account: AccountResponse;
  skin: AccountCardSkin;
  index: number;
  /** Cards in the deck, which decides whether it loops and so how far away this card is. */
  count: number;
  position: SharedValue<number>;
  width: number;
  height: number;
  left: number;
  top: number;
  flat: boolean;
  onPress: (index: number, accountId: string) => void;
}) {
  const theme = useTheme();
  const radius = accountCardRadius(account.type, theme);
  const handlePress = useCallback(() => onPress(index, account.id), [onPress, index, account.id]);

  const poseStyle = useAnimatedStyle(() => {
    const offset = deckOffset(index, position.value, count);
    const pose = deckPose(offset, deckFadeEnd(count));
    // Whole steps, so the layout commit it costs happens once per crossing; Android draws by elevation before zIndex.
    const layer = deckLayer(offset);
    return {
      zIndex: layer,
      elevation: layer,
      opacity: pose.opacity,
      transform: [
        { perspective: DECK.perspective },
        { translateX: pose.shift * width },
        { rotateY: flat ? '0deg' : `${pose.rotateYDeg}deg` },
        { scale: flat ? 1 : pose.scale },
      ],
    };
  }, [index, count, width, flat]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: deckPose(deckOffset(index, position.value, count)).glow }), [index, count]);
  // Only the front card and its neighbours take a tap: one further out is faded but still laid out past their edge.
  const touchProps = useAnimatedProps(
    () => ({ pointerEvents: Math.abs(deckOffset(index, position.value, count)) < 1.5 ? ('auto' as const) : ('none' as const) }),
    [index, count],
  );
  const reachX = width * BACKLIGHT.spreadX;
  const reachY = height * BACKLIGHT.spreadY;

  return (
    <Animated.View
      testID={`card-account-${account.id}`}
      animatedProps={touchProps}
      style={[{ position: 'absolute', left, top, width }, poseStyle]}
    >
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: -reachY, right: -reachX, bottom: -reachY, left: -reachX }, glowStyle]}
      >
        <Backlight accountId={account.id} color={skin.to} width={width} height={height} reachX={reachX} reachY={reachY} />
      </Animated.View>
      <ThemedView style={[{ borderRadius: radius }, theme.shadows.lg]}>
        <AccountCard account={account} skin={skin} width={width} onPress={handlePress} />
      </ThemedView>
    </Animated.View>
  );
});

/** The card's coloured backlight: drawn once, then only moved and faded with the card. */
const Backlight = memo(function Backlight({
  accountId,
  color,
  width,
  height,
  reachX,
  reachY,
}: {
  accountId: string;
  color: string;
  width: number;
  height: number;
  reachX: number;
  reachY: number;
}) {
  const id = `backlight-${accountId}`;
  // Where the card's nearest edge falls along the oval's radius; the fade runs from there to the oval's rim.
  const edge = Math.min(width / (width + reachX * 2), height / (height + reachY * 2));
  const at = (share: number) => edge + (1 - edge) * share;
  return (
    <Svg width={width + reachX * 2} height={height + reachY * 2}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset={edge} stopColor={color} stopOpacity={BACKLIGHT.alpha} />
          <Stop offset={at(0.3)} stopColor={color} stopOpacity={BACKLIGHT.alpha * 0.55} />
          <Stop offset={at(0.6)} stopColor={color} stopOpacity={BACKLIGHT.alpha * 0.2} />
          <Stop offset={at(0.85)} stopColor={color} stopOpacity={BACKLIGHT.alpha * 0.05} />
          <Stop offset={1} stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={width + reachX * 2} height={height + reachY * 2} fill={`url(#${id})`} />
    </Svg>
  );
});

/**
 * The names under the deck. Follows `position` on the UI thread, so it moves with the finger; a tap brings
 * that card forward.
 */
function DeckNames({
  accounts,
  skinOf,
  position,
  width,
  shown,
  onSelect,
}: {
  accounts: AccountResponse[];
  skinOf: (accountId: string) => AccountCardSkin;
  position: SharedValue<number>;
  width: number;
  shown: number;
  onSelect: (index: number) => void;
}) {
  const theme = useTheme();
  const labelWidth = width / 3;

  return (
    <View style={{ height: theme.sizes.touchTarget, overflow: 'hidden' }}>
      {accounts.map((account, index) => (
        <DeckName
          key={account.id}
          account={account}
          color={skinOf(account.id).to}
          index={index}
          count={accounts.length}
          position={position}
          width={labelWidth}
          active={index === shown}
          onSelect={onSelect}
        />
      ))}
    </View>
  );
}

const DeckName = memo(function DeckName({
  account,
  color,
  index,
  count,
  position,
  width,
  active,
  onSelect,
}: {
  account: AccountResponse;
  color: string;
  index: number;
  count: number;
  position: SharedValue<number>;
  width: number;
  active: boolean;
  onSelect: (index: number) => void;
}) {
  const theme = useTheme();
  const dim = theme.opacity.muted;
  const labelStyle = useAnimatedStyle(() => {
    const offset = deckOffset(index, position.value, count);
    const away = Math.abs(offset);
    const fadeEnd = deckFadeEnd(count);
    return {
      // Centre slot in front, a slot either side for the neighbours; bright in front, dim beside it, gone past them.
      transform: [{ translateX: width * (1 + offset) }],
      opacity: away <= 1 ? 1 - away * (1 - dim) : Math.max(0, (dim * (fadeEnd - away)) / (fadeEnd - 1)),
    };
  }, [index, count, width, dim]);
  const underlineStyle = useAnimatedStyle(
    () => ({ opacity: Math.max(0, 1 - Math.abs(deckOffset(index, position.value, count))) }),
    [index, count],
  );

  return (
    <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width }, labelStyle]}>
      <Pressable
        testID={`option-account-deck-${account.id}`}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={() => onSelect(index)}
        className="items-center"
        style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.xs, paddingHorizontal: theme.spacing.xs }}
      >
        <Text variant="label" weight="semibold" numberOfLines={1}>
          {account.name}
        </Text>
        <Animated.View
          style={[{ height: theme.borderWidth.thick, width: '70%', borderRadius: theme.radius.pill, backgroundColor: color }, underlineStyle]}
        />
      </Pressable>
    </Animated.View>
  );
});
