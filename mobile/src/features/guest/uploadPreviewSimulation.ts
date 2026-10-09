import { UPLOAD_PHASES, type UploadPhase } from '../../services/guest/guestUpload.ts';
import type { GuestUploadView } from './useGuestUpload.ts';

export type SimulatedCounts = Readonly<Record<UploadPhase, number>>;

/** The demo fixture's shape (scripts/seed --guest-fixture), so the preview paces like a real year of data. */
export const SIMULATED_TOTALS: SimulatedCounts = {
  categories: 53,
  accounts: 8,
  goals: 47,
  transactions: 1568,
  budgets: 11,
  archives: 4,
};

/** Ticks each step takes; transactions dominate a real upload, so they get most of the run. */
const TICKS_PER_PHASE: Record<UploadPhase, number> = {
  categories: 12,
  accounts: 6,
  goals: 12,
  transactions: 160,
  budgets: 8,
  archives: 6,
};

export const NO_ROWS_UPLOADED: SimulatedCounts = { categories: 0, accounts: 0, goals: 0, transactions: 0, budgets: 0, archives: 0 };

export function isFinished(counts: SimulatedCounts): boolean {
  return UPLOAD_PHASES.every((phase) => counts[phase] >= SIMULATED_TOTALS[phase]);
}

/** One tick: the first unfinished step moves on, as the real sequencer works one step at a time. */
export function advance(counts: SimulatedCounts): SimulatedCounts {
  const phase = UPLOAD_PHASES.find((candidate) => counts[candidate] < SIMULATED_TOTALS[candidate]);
  if (!phase) return counts;
  const step = Math.ceil(SIMULATED_TOTALS[phase] / TICKS_PER_PHASE[phase]);
  return { ...counts, [phase]: Math.min(SIMULATED_TOTALS[phase], counts[phase] + step) };
}

/** The same shape `useGuestUploadView` gives the real screen. */
export function simulatedView(counts: SimulatedCounts): GuestUploadView {
  const steps = Object.fromEntries(
    UPLOAD_PHASES.map((phase) => [phase, { done: counts[phase], total: SIMULATED_TOTALS[phase] }]),
  ) as GuestUploadView['steps'];
  const donePhases: UploadPhase[] = [];
  for (const phase of UPLOAD_PHASES) {
    if (counts[phase] < SIMULATED_TOTALS[phase]) break;
    donePhases.push(phase);
  }
  const doneRows = UPLOAD_PHASES.reduce((sum, phase) => sum + counts[phase], 0);
  const totalRows = UPLOAD_PHASES.reduce((sum, phase) => sum + SIMULATED_TOTALS[phase], 0);
  return { donePhases, steps, doneRows, totalRows, fraction: doneRows / totalRows };
}
