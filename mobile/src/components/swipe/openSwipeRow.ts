export interface SwipeRowHandle {
  close: () => void;
}

let openRow: SwipeRowHandle | null = null;

/** Marks `row` as the open one, closing whichever row was open before it. */
export function claimOpenSwipeRow(row: SwipeRowHandle): void {
  if (openRow !== null && openRow !== row) openRow.close();
  openRow = row;
}

/** Forgets `row` if it is still the open one; a row closing late can't clear a newer row's claim. */
export function releaseOpenSwipeRow(row: SwipeRowHandle): void {
  if (openRow === row) openRow = null;
}

/** Closes the open row, if any — a list calls this when it starts scrolling. */
export function closeOpenSwipeRow(): void {
  const row = openRow;
  openRow = null;
  row?.close();
}

export function isOpenSwipeRow(row: SwipeRowHandle): boolean {
  return openRow === row;
}
