import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { runOptimisticMutation } from './optimisticMutation.ts';

describe('runOptimisticMutation', () => {
  it('applies optimistically, then reconciles with the resolved result', async () => {
    const events: string[] = [];
    const applyOptimistic = () => {
      events.push('apply');
      return { undo: () => events.push('undo') };
    };
    const applyResult = (data: string) => events.push(`result:${data}`);

    await runOptimisticMutation(Promise.resolve({ data: 'server' }), applyOptimistic, applyResult);

    assert.deepEqual(events, ['apply', 'result:server']);
  });

  it('undoes the optimistic apply when the underlying call rejects', async () => {
    const events: string[] = [];
    const applyOptimistic = () => {
      events.push('apply');
      return { undo: () => events.push('undo') };
    };
    const applyResult = () => events.push('result');

    await runOptimisticMutation(Promise.reject(new Error('failed')), applyOptimistic, applyResult);

    assert.deepEqual(events, ['apply', 'undo']);
  });
});
