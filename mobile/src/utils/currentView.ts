/**
 * What a view that stays mounted while its query argument changes (a detail sheet between opens, a
 * screen across a wallet switch) may show from its RTK Query result.
 *
 * `data` keeps the previous argument's result while the next one loads, with `isLoading` false, so a
 * view reading it shows the last entity or wallet while its actions already target the new one. An
 * active view reads only `currentData`; an inactive one (argument cleared, query skipped) keeps the
 * last result, which is what it is closing on.
 */
export interface QueryViewState<T> {
  data?: T;
  currentData?: T;
  isFetching: boolean;
}

export function currentView<T>(query: QueryViewState<T>, active: boolean): { data: T | undefined; loading: boolean } {
  if (!active) return { data: query.data, loading: false };
  return { data: query.currentData, loading: query.currentData === undefined && query.isFetching };
}
