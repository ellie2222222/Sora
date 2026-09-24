import { useEffect, useRef } from 'react';

/**
 * Picks the first item whenever nothing is selected and the list has loaded — a deliberate UX
 * shortcut, not just an init step: clearing the value later re-selects the first item again.
 * `enabled: false` is for pickers where an empty selection is valid (a transfer's category).
 */
export function useDefaultToFirst<T>(
  list: readonly T[] | undefined,
  value: string | null | undefined,
  onSelect: (first: T) => void,
  enabled = true,
): void {
  // A ref so callers can pass an inline closure without re-running the effect every render.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!enabled || (value !== null && value !== undefined && value !== '')) return;
    const first = list?.[0];
    if (first !== undefined) onSelectRef.current(first);
  }, [enabled, list, value]);
}
