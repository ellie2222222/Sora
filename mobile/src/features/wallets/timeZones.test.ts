import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { timeZoneLabel, timeZoneOptions } from './timeZones.ts';

describe('timeZoneOptions', () => {
  it("puts the wallet's and the device's zone first, once each", () => {
    const options = timeZoneOptions(['Asia/Ho_Chi_Minh', 'Asia/Ho_Chi_Minh', 'America/Los_Angeles'], '');
    assert.deepEqual(options.slice(0, 2), ['Asia/Ho_Chi_Minh', 'America/Los_Angeles']);
    assert.equal(options.filter((zone) => zone === 'Asia/Ho_Chi_Minh').length, 1);
  });

  it('matches a search typed with spaces, case-insensitively', () => {
    assert.ok(timeZoneOptions([], 'ho chi').includes('Asia/Ho_Chi_Minh'));
    assert.ok(timeZoneOptions([], 'LOS_ANGELES').includes('America/Los_Angeles'));
  });

  it('offers a valid zone the list lacks, and never an offset', () => {
    assert.equal(timeZoneOptions([], 'Etc/GMT-7')[0], 'Etc/GMT-7');
    assert.deepEqual(timeZoneOptions([], '+07:00'), []);
  });
});

describe('timeZoneLabel', () => {
  it('reads as words', () => {
    assert.equal(timeZoneLabel('America/Los_Angeles'), 'America / Los Angeles');
  });
});
