import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { INITIAL_NOTICE_STATE, OUTAGE_NOTICE_COOLDOWN_MS, noticeFor, type NoticeState } from './connectivityNotices.ts';

function run(changes: [online: boolean, deviceOnline: boolean, at: number][]) {
  let state: NoticeState = INITIAL_NOTICE_STATE;
  return changes.map(([online, deviceOnline, at]) => {
    const next = noticeFor(state, online, deviceOnline, at);
    state = next.state;
    return next.notice;
  });
}

describe('noticeFor', () => {
  it('says the API is unreachable when the device has internet, offline when it has none', () => {
    assert.deepEqual(run([[false, true, 0]]), ['unreachable']);
    assert.deepEqual(run([[false, false, 0]]), ['offline']);
  });

  it('says the API is back only after an outage it reported', () => {
    assert.deepEqual(run([[true, true, 0]]), [null]);
    assert.deepEqual(run([[false, true, 0], [true, true, 1_000]]), ['unreachable', 'reconnected']);
  });

  it('stays quiet when the connection flaps within the cooldown, and speaks again after it', () => {
    const later = OUTAGE_NOTICE_COOLDOWN_MS + 1;
    assert.deepEqual(
      run([
        [false, true, 0],
        [true, true, 1_000],
        [false, true, 2_000],
        [true, true, 3_000],
        [false, true, later],
        [true, true, later + 1],
      ]),
      ['unreachable', 'reconnected', null, null, 'unreachable', 'reconnected'],
    );
  });
});
