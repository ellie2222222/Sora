import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { isLibraryWarning, silenceWebLibraryWarnings } from './webLibraryWarnings.ts';

describe('isLibraryWarning', () => {
  it('matches the two react-native-web library warnings', () => {
    assert.equal(isLibraryWarning(['props.pointerEvents is deprecated. Use style.pointerEvents']), true);
    assert.equal(isLibraryWarning(['Cannot record touch end without a touch start.\n', 'Touch End: {}', 'Touch Bank: []']), true);
  });

  it('lets every other warning through', () => {
    assert.equal(isLibraryWarning(['Each child in a list should have a unique "key" prop.']), false);
    assert.equal(isLibraryWarning([new Error('props.pointerEvents is deprecated')]), false);
    assert.equal(isLibraryWarning([]), false);
  });
});

describe('silenceWebLibraryWarnings', () => {
  it('leaves console.warn untouched off web or outside development', () => {
    const original = console.warn;
    silenceWebLibraryWarnings(false, true);
    silenceWebLibraryWarnings(true, false);
    assert.equal(console.warn, original);
  });

  it('drops only the library warnings on web in development', () => {
    const original = console.warn;
    const printed: unknown[][] = [];
    console.warn = (...args: unknown[]) => printed.push(args);
    try {
      silenceWebLibraryWarnings(true, true);
      console.warn('props.pointerEvents is deprecated. Use style.pointerEvents');
      console.warn('something real');
      assert.deepEqual(printed, [['something real']]);
    } finally {
      console.warn = original;
    }
  });
});
