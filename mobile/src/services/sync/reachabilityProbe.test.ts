import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { PROBE_DELAYS_MS, STABLE_MS, delayForAttempt, startReachabilityProbe } from './reachabilityProbe.ts';

function harness(answers: boolean[], { internet = true, online = false } = {}) {
  let flag = online;
  let clock = 0;
  const listeners = new Set<(online: boolean) => void>();
  const timers: { run: () => void; ms: number }[] = [];
  const pings: number[] = [];
  const setOnline = (value: boolean) => {
    if (value === flag) return;
    flag = value;
    for (const listener of listeners) listener(value);
  };
  const stop = startReachabilityProbe({
    ping: async () => {
      pings.push(timers.length);
      return answers.shift() ?? false;
    },
    isOnline: () => flag,
    setOnline,
    onOnlineChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    canReachInternet: () => internet,
    now: () => clock,
    setTimer: (run, ms) => {
      const timer = { run, ms };
      timers.push(timer);
      return timer;
    },
    clearTimer: (handle) => {
      const index = timers.indexOf(handle as never);
      if (index >= 0) timers.splice(index, 1);
    },
  });
  /** Fires the one pending timer and lets the probe's ping settle. */
  const tick = async () => {
    const timer = timers.shift();
    assert.ok(timer, 'a probe should be scheduled');
    timer.run();
    await new Promise((resolve) => setImmediate(resolve));
    return timer.ms;
  };
  const advance = (ms: number) => {
    clock += ms;
  };
  return { tick, timers, pings, setOnline, isOnline: () => flag, stop, advance };
}

describe('startReachabilityProbe', () => {
  it('backs off while the API stays down and marks it reachable once it answers', async () => {
    const probe = harness([false, false, true]);
    assert.equal(await probe.tick(), PROBE_DELAYS_MS[0]);
    assert.equal(await probe.tick(), PROBE_DELAYS_MS[1]);
    assert.equal(await probe.tick(), PROBE_DELAYS_MS[2]);
    assert.equal(probe.isOnline(), true);
    assert.equal(probe.timers.length, 0, 'nothing more is scheduled once reachable');
    assert.equal(probe.pings.length, 3);
  });

  it('caps the delay instead of growing it forever', () => {
    assert.equal(delayForAttempt(0), PROBE_DELAYS_MS[0]);
    assert.equal(delayForAttempt(99), PROBE_DELAYS_MS[PROBE_DELAYS_MS.length - 1]);
  });

  it('does nothing while online, and starts over from the shortest delay on the next outage', async () => {
    const probe = harness([false, false], { online: true });
    assert.equal(probe.timers.length, 0);
    probe.setOnline(false);
    assert.equal(await probe.tick(), PROBE_DELAYS_MS[0]);
    probe.setOnline(true);
    assert.equal(probe.timers.length, 0, 'a read that succeeded cancels the pending probe');
    probe.advance(STABLE_MS);
    probe.setOnline(false);
    assert.equal(await probe.tick(), PROBE_DELAYS_MS[0]);
  });

  it('keeps backing off when the API falls again soon after coming back, and starts over once it held', async () => {
    const probe = harness([true, true, true]);
    assert.equal(await probe.tick(), PROBE_DELAYS_MS[0]);
    probe.advance(1_000);
    probe.setOnline(false);
    assert.equal(await probe.tick(), PROBE_DELAYS_MS[1], 'a read failing right after recovery does not reset the backoff');
    probe.advance(1_000);
    probe.setOnline(false);
    assert.equal(await probe.tick(), PROBE_DELAYS_MS[2]);
    probe.advance(STABLE_MS);
    probe.setOnline(false);
    assert.equal(probe.timers[0]?.ms, PROBE_DELAYS_MS[0]);
  });

  it('does not ask the API while the device has no internet, but keeps checking back', async () => {
    const probe = harness([true], { internet: false });
    await probe.tick();
    assert.equal(probe.pings.length, 0);
    assert.equal(probe.isOnline(), false);
    assert.equal(probe.timers.length, 1);
  });

  it('stops for good when torn down', async () => {
    const probe = harness([true]);
    probe.stop();
    assert.equal(probe.timers.length, 0);
    probe.setOnline(true);
    probe.setOnline(false);
    assert.equal(probe.timers.length, 0);
  });
});
