export interface Point {
  x: number;
  y: number;
}

export interface DonutCallout {
  id: string;
  side: 'left' | 'right';
  /** Where the leader line touches the ring, at the slice's middle. */
  tip: Point;
  elbow: Point;
  /** Where the leader line ends and the label begins. */
  end: Point;
}

export interface DonutCalloutGeometry {
  width: number;
  /** The canvas grows past this when one side has more labels than fit. */
  minHeight: number;
  ringOuter: number;
  /** How far the leader runs out from the ring before turning sideways. */
  radial: number;
  /** Distance from the centre to the column every label lines up on. */
  column: number;
  labelHeight: number;
}

export interface DonutCalloutLayout {
  height: number;
  callouts: DonutCallout[];
}

/**
 * One callout per slice, each leading from its slice's middle. Labels stack in a column on their
 * slice's side and are pushed apart so none overlap, the canvas growing tall enough to hold them all.
 */
export function layoutDonutCallouts(
  slices: readonly { id: string; percentage: number }[],
  geometry: DonutCalloutGeometry,
): DonutCalloutLayout {
  const { width, minHeight, ringOuter, radial, column, labelHeight } = geometry;

  let cumulative = 0;
  const candidates = slices.flatMap((slice) => {
    const percentage = Math.max(slice.percentage, 0);
    const middle = cumulative + percentage / 2;
    cumulative += percentage;
    // A zero slice draws no arc, so there is nothing to point at.
    if (percentage === 0) return [];
    // Clockwise from twelve o'clock, the way the ring is drawn; screen y grows downwards.
    const angle = (middle / 100) * 2 * Math.PI - Math.PI / 2;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    return [{ id: slice.id, percentage, dir, side: dir.x >= 0 ? ('right' as const) : ('left' as const) }];
  });

  const tallestSide = Math.max(...(['right', 'left'] as const).map((side) => candidates.filter((candidate) => candidate.side === side).length));
  const height = Math.max(minHeight, tallestSide * labelHeight);
  const cx = width / 2;
  const cy = height / 2;

  const callouts: DonutCallout[] = [];
  for (const side of ['right', 'left'] as const) {
    const onSide = candidates
      .filter((candidate) => candidate.side === side)
      .map((candidate) => ({ ...candidate, labelY: cy + (ringOuter + radial) * candidate.dir.y }))
      .sort((a, b) => a.labelY - b.labelY);

    for (let index = 1; index < onSide.length; index += 1) {
      onSide[index]!.labelY = Math.max(onSide[index]!.labelY, onSide[index - 1]!.labelY + labelHeight);
    }
    let floor = height - labelHeight / 2;
    for (let index = onSide.length - 1; index >= 0; index -= 1) {
      onSide[index]!.labelY = Math.min(onSide[index]!.labelY, floor);
      floor = onSide[index]!.labelY - labelHeight;
    }
    for (const candidate of onSide) candidate.labelY = Math.max(candidate.labelY, labelHeight / 2);

    for (const { id, dir, labelY } of onSide) {
      callouts.push({
        id,
        side,
        tip: { x: cx + ringOuter * dir.x, y: cy + ringOuter * dir.y },
        elbow: { x: cx + (ringOuter + radial) * dir.x, y: cy + (ringOuter + radial) * dir.y },
        end: { x: side === 'right' ? cx + column : cx - column, y: labelY },
      });
    }
  }
  return { height, callouts };
}

/**
 * The largest `keep` slices, biggest first, and the rest summed as one "others" share. A lone leftover
 * keeps its own name: an "Others" holding one category hides it without saving any room.
 */
export function groupDonutSlices<T extends { percentage: number }>(
  slices: readonly T[],
  keep: number,
): { top: T[]; othersPercentage: number } {
  const ranked = [...slices].sort((a, b) => b.percentage - a.percentage);
  if (ranked.length <= keep + 1) return { top: ranked, othersPercentage: 0 };
  const rest = ranked.slice(keep);
  return { top: ranked.slice(0, keep), othersPercentage: rest.reduce((sum, slice) => sum + Math.max(slice.percentage, 0), 0) };
}
