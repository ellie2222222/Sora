import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { currentView } from './currentView.ts';

const budgetA = { id: 'A' };
const budgetB = { id: 'B' };

describe('currentView', () => {
  it('shows nothing of the last entity while a newly opened one loads, and reports it loading', () => {
    // RTK Query's shape while B fetches after A: `data` still holds A, `currentData` has nothing yet.
    assert.deepEqual(currentView({ data: budgetA, currentData: undefined, isFetching: true }, true), { data: undefined, loading: true });
  });

  it('shows the opened entity once it is the current result', () => {
    assert.deepEqual(currentView({ data: budgetB, currentData: budgetB, isFetching: false }, true), { data: budgetB, loading: false });
  });

  it('keeps a cached entity on screen while it refetches', () => {
    assert.deepEqual(currentView({ data: budgetB, currentData: budgetB, isFetching: true }, true), { data: budgetB, loading: false });
  });

  it('reports a failed load as no data rather than loading, so the sheet can show its error', () => {
    assert.deepEqual(currentView({ data: budgetA, currentData: undefined, isFetching: false }, true), { data: undefined, loading: false });
  });

  it('keeps the closing entity for the slide-out once the query is skipped', () => {
    assert.deepEqual(currentView({ data: budgetA, currentData: undefined, isFetching: false }, false), { data: budgetA, loading: false });
  });
});
