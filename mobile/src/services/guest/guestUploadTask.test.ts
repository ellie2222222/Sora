import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { GuestUploadCancelledError } from './guestUpload.ts';
import { createGuestUploadTask, type GuestUploadStatus } from './guestUploadTask.ts';

/** A run that waits until the test lets it finish, and stops at that point if it was cancelled. */
function controllableRun() {
  let finish!: () => void;
  let fail!: (error: unknown) => void;
  const gate = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const run = async (signal: AbortSignal) => {
    await gate;
    if (signal.aborted) throw new GuestUploadCancelledError();
  };
  return { run, finish, fail };
}

function statuses(task: ReturnType<typeof createGuestUploadTask>): GuestUploadStatus[] {
  const seen: GuestUploadStatus[] = [];
  task.subscribe((state) => {
    if (seen.at(-1) !== state.status) seen.push(state.status);
  });
  return seen;
}

describe('guestUploadTask', () => {
  it('runs to done', async () => {
    const task = createGuestUploadTask();
    const seen = statuses(task);
    const { run, finish } = controllableRun();

    const started = task.start('wallet-1', run);
    assert.equal(task.current().walletId, 'wallet-1');
    finish();
    await started;

    assert.deepEqual(seen, ['running', 'done']);
  });

  it('cancel lets the request in flight finish, then stops', async () => {
    const task = createGuestUploadTask();
    const seen = statuses(task);
    const { run, finish } = controllableRun();

    const started = task.start('wallet-1', run);
    task.cancel();
    assert.equal(task.current().status, 'stopping');
    finish();
    await started;

    assert.deepEqual(seen, ['running', 'stopping', 'stopped']);
  });

  it('keeps the error of a failed run, and can start again after it', async () => {
    const task = createGuestUploadTask();
    const first = controllableRun();
    const started = task.start('wallet-1', first.run);
    const error = new Error('network down');
    first.fail(error);
    await started;
    assert.equal(task.current().status, 'failed');
    assert.equal(task.current().error, error);

    const second = controllableRun();
    const resumed = task.start('wallet-1', second.run);
    assert.equal(task.current().error, null);
    second.finish();
    await resumed;
    assert.equal(task.current().status, 'done');
  });

  it('ignores a second start while one is running', async () => {
    const task = createGuestUploadTask();
    const first = controllableRun();
    let secondRan = false;

    const started = task.start('wallet-1', first.run);
    await task.start('wallet-2', async () => {
      secondRan = true;
    });
    first.finish();
    await started;

    assert.equal(secondRan, false);
    assert.equal(task.current().walletId, 'wallet-1');
  });

  it('a reset (sign-out) forgets the run, and its late outcome is ignored', async () => {
    const task = createGuestUploadTask();
    const { run, finish } = controllableRun();

    const started = task.start('wallet-1', run);
    task.setInBackground(true);
    task.reset();
    finish();
    await started;

    assert.deepEqual(task.current(), { status: 'idle', walletId: null, error: null, inBackground: false });
  });

  it('stays in the background while the upload keeps running', async () => {
    const task = createGuestUploadTask();
    const { run, finish } = controllableRun();

    const started = task.start('wallet-1', run);
    task.setInBackground(true);
    assert.equal(task.current().inBackground, true);
    assert.equal(task.current().status, 'running');
    finish();
    await started;
    assert.equal(task.current().inBackground, true);
  });
});
