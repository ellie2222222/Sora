import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  DECK,
  deckFadeEnd,
  deckFrontIndex,
  deckLayer,
  deckLoops,
  deckOffset,
  deckPose,
  deckSnapIndex,
  deckTargetFor,
} from './carouselLayout.ts';

describe('deckPose', () => {
  it('puts the front card straight on, full size and lit', () => {
    const front = deckPose(0);
    assert.equal(front.shift, 0);
    assert.equal(front.scale, 1);
    assert.equal(front.glow, 1);
    assert.equal(front.opacity, 1);
  });

  it('tucks the previous and next card beside and behind it, mirrored, smaller, angled in and unlit', () => {
    const next = deckPose(1);
    const previous = deckPose(-1);
    assert.equal(next.shift, DECK.sideShift);
    assert.equal(previous.shift, -DECK.sideShift);
    assert.equal(next.scale, DECK.sideScale);
    assert.equal(next.rotateYDeg, -DECK.tiltDeg);
    assert.equal(previous.rotateYDeg, DECK.tiltDeg);
    assert.equal(next.glow, 0);
  });

  it('eases between places during a drag, swinging two passing cards apart before tucking one behind', () => {
    const half = deckPose(0.5);
    assert.equal(half.glow, 0.5);
    assert.ok(half.shift > DECK.sideShift / 2);
    assert.equal(deckPose(-0.5).shift, -half.shift);
  });

  it('shows a second neighbour only mid-drag, further out than the first, and hides anything beyond', () => {
    const second = deckPose(2);
    assert.ok(second.shift > DECK.sideShift);
    assert.equal(second.opacity, 0);
    assert.equal(deckPose(1.5).opacity, 0.5);
    assert.deepEqual(deckPose(7), second);
  });
});

describe('deckLayer', () => {
  it('draws the card nearest the front on top, swapping two cards only as they cross', () => {
    assert.ok(deckLayer(0) > deckLayer(1));
    assert.ok(deckLayer(0.4) > deckLayer(-0.6));
    assert.ok(deckLayer(-0.4) > deckLayer(0.6));
    assert.equal(deckLayer(0.2), deckLayer(0));
    assert.equal(deckLayer(9), deckLayer(DECK.mountedRange));
  });
});

describe('deckSnapIndex', () => {
  it('settles on the nearest card when let go slowly', () => {
    assert.equal(deckSnapIndex(1.4, 1, 0, 280, 4), 1);
    assert.equal(deckSnapIndex(1.6, 1, 0, 280, 4), 2);
  });

  it('carries a fling on to the next card, but never more than one past where the drag began', () => {
    assert.equal(deckSnapIndex(1.2, 1, -1200, 280, 4), 2);
    assert.equal(deckSnapIndex(0.8, 1, 1200, 280, 4), 0);
    assert.equal(deckSnapIndex(1.9, 1, -9000, 280, 6), 2);
  });

  it('never leaves either end of a deck too small to loop', () => {
    assert.equal(deckSnapIndex(-0.4, 0, 3000, 280, 2), 0);
    assert.equal(deckSnapIndex(1.3, 1, -3000, 280, 2), 1);
    assert.equal(deckSnapIndex(0, 0, 0, 280, 0), 0);
  });
});

describe('looping', () => {
  it('loops a deck of three or more, never one of two', () => {
    assert.equal(deckLoops(2), false);
    assert.equal(deckLoops(3), true);
  });

  it('puts the first card next after the last, and the last before the first', () => {
    assert.equal(deckOffset(0, 4, 5), 1);
    assert.equal(deckOffset(4, 0, 5), -1);
    assert.equal(deckOffset(4, 0, 2), 4);
  });

  it('reads the front card off an unbounded position', () => {
    assert.equal(deckFrontIndex(-1, 5), 4);
    assert.equal(deckFrontIndex(7, 5), 2);
    assert.equal(deckFrontIndex(7, 2), 1);
  });

  it('flings past either end of a looping deck, one card at a time', () => {
    assert.equal(deckSnapIndex(4.2, 4, -1200, 280, 5), 5);
    assert.equal(deckSnapIndex(-0.2, 0, 1200, 280, 5), -1);
  });

  it('brings a chosen card forward the short way round', () => {
    assert.equal(deckTargetFor(0, 4, 5), 5);
    assert.equal(deckTargetFor(4, 0, 5), -1);
    assert.equal(deckTargetFor(3, 2, 3), 3);
  });

  it('fades a card out before it wraps from one side of a small deck to the other', () => {
    assert.equal(deckPose(1.5, deckFadeEnd(3)).opacity, 0);
    assert.equal(deckFadeEnd(6), DECK.visibleRange);
  });
});
