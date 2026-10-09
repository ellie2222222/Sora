import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { UPLOAD_PHASES } from '../../services/guest/guestUpload.ts';
import { NO_ROWS_UPLOADED, SIMULATED_TOTALS, advance, isFinished, simulatedView } from './uploadPreviewSimulation.ts';

describe('the upload preview simulation', () => {
  it('fills one step at a time, in the real run order, and finishes', () => {
    let counts = NO_ROWS_UPLOADED;
    const startedOrder: string[] = [];
    for (let tick = 0; tick < 1000 && !isFinished(counts); tick++) {
      const next = advance(counts);
      const moved = UPLOAD_PHASES.filter((phase) => next[phase] !== counts[phase]);
      assert.equal(moved.length, 1);
      if (startedOrder.at(-1) !== moved[0]) startedOrder.push(moved[0]!);
      counts = next;
    }
    assert.ok(isFinished(counts));
    assert.deepEqual(startedOrder, [...UPLOAD_PHASES]);
  });

  it('reports the finished prefix of steps and every row, like the real view', () => {
    const counts = { ...NO_ROWS_UPLOADED, categories: SIMULATED_TOTALS.categories, accounts: 3 };
    const view = simulatedView(counts);
    assert.deepEqual(view.donePhases, ['categories']);
    assert.deepEqual(view.steps.accounts, { done: 3, total: SIMULATED_TOTALS.accounts });
    assert.equal(view.doneRows, SIMULATED_TOTALS.categories + 3);
    assert.equal(simulatedView(SIMULATED_TOTALS).fraction, 1);
  });
});
