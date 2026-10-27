/**
 * The accounts deck: one card in front, the previous and next tucked beside and behind it. `position` is
 * which card is in front, fractional while a drag is between two; `offset` is a card's index minus it.
 * Every function here also runs on the UI thread, once per frame of a drag.
 */
export const DECK = {
  /** The front card's share of the row's width; the rest is where its neighbours show. */
  cardShare: 0.78,
  /** How far a neighbour sits out from behind the front card, as a share of the card's width. */
  sideShift: 0.26,
  sideScale: 0.86,
  tiltDeg: 16,
  /** How far two cards swing apart as they pass, as a share of `sideShift`, so the one going behind is not covered all at once. */
  crossFan: 0.5,
  perspective: 1000,
  /** Cards this far from the front or further are fully faded out. */
  visibleRange: 2,
  /** Cards this far from the settled one stay mounted, one past what shows, so a drag never mounts a card. */
  mountedRange: 3,
  /** The fewest cards that loop round: with two, the card before and the card after would be the same one. */
  loopFrom: 3,
  /** How much a fling's speed carries on past the card under the finger, in cards per (px/s / card width). */
  flingCarry: 0.2,
} as const;

export interface DeckPose {
  /** Horizontal shift as a share of the card's width. */
  shift: number;
  scale: number;
  rotateYDeg: number;
  /** 1 for the card in front, fading to 0 one card away: its backlight. */
  glow: number;
  opacity: number;
}

/** Whether a deck of `count` cards loops, the last card's next being the first. */
export function deckLoops(count: number): boolean {
  'worklet';
  return count >= DECK.loopFrom;
}

/**
 * How far a card sits from the front, `position` being unbounded in a looping deck. Looping, it is taken the short
 * way round, so every card is at most half the deck away.
 */
export function deckOffset(index: number, position: number, count: number): number {
  'worklet';
  const raw = index - position;
  return deckLoops(count) ? raw - count * Math.round(raw / count) : raw;
}

/** The card in front at an unbounded `position`, as an index into the deck. */
export function deckFrontIndex(position: number, count: number): number {
  'worklet';
  if (count === 0) return 0;
  const settled = Math.round(position);
  return deckLoops(count) ? ((settled % count) + count) % count : Math.max(0, Math.min(count - 1, settled));
}

/**
 * Where a card is drawn at `offset` from the front. `fadeEnd` is how far away it has faded out entirely: half a
 * small looping deck, so a card is invisible by the time it wraps from one side to the other.
 */
export function deckFadeEnd(count: number): number {
  'worklet';
  return deckLoops(count) ? Math.min(DECK.visibleRange, count / 2) : DECK.visibleRange;
}

// No default parameter: a worklet's captured constants are unpacked in its body, after defaults are evaluated.
export function deckPose(offset: number, fadeEndAt?: number): DeckPose {
  'worklet';
  const fadeEnd = fadeEndAt ?? DECK.visibleRange;
  const clamped = Math.max(-DECK.visibleRange, Math.min(DECK.visibleRange, offset));
  const away = Math.abs(clamped);
  const side = Math.sign(clamped);
  const nearAway = Math.min(away, 1);
  return {
    // A second neighbour sits half a step further out, seen only while a drag brings it within reach.
    shift: side * DECK.sideShift * (nearAway + DECK.crossFan * Math.sin(Math.PI * nearAway) + Math.max(away - 1, 0) * 0.5),
    scale: 1 - away * (1 - DECK.sideScale),
    rotateYDeg: -side * nearAway * DECK.tiltDeg,
    glow: 1 - nearAway,
    opacity: away <= 1 ? 1 : Math.max(0, (fadeEnd - away) / (fadeEnd - 1)),
  };
}

/** Draw order: the card nearest the front on top. Whole steps only, so it changes once as two cards cross. */
export function deckLayer(offset: number): number {
  'worklet';
  return DECK.mountedRange + 1 - Math.round(Math.min(Math.abs(offset), DECK.mountedRange));
}

/**
 * The position a drag ends on: where it was let go, carried on by the fling, one card at most past where it began.
 * A looping deck has no ends, so the result is unbounded there; `deckFrontIndex` turns it into a card.
 */
export function deckSnapIndex(position: number, startIndex: number, velocityX: number, cardWidth: number, count: number): number {
  'worklet';
  if (count === 0) return 0;
  const carried = cardWidth > 0 ? position - (velocityX * DECK.flingCarry) / cardWidth : position;
  const target = Math.round(Math.max(startIndex - 1, Math.min(startIndex + 1, carried)));
  return deckLoops(count) ? target : Math.max(0, Math.min(count - 1, target));
}

/** The position that brings card `index` to the front from `position`, the short way round when the deck loops. */
export function deckTargetFor(index: number, position: number, count: number): number {
  'worklet';
  if (!deckLoops(count)) return Math.max(0, Math.min(count - 1, index));
  const settled = Math.round(position);
  return settled + Math.round(deckOffset(index, settled, count));
}
