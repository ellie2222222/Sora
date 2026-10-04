import type { GoalResponse, UpdateGoalRequest } from '@sora/contracts';

export interface GoalDraft {
  name: string;
  description: string;
  targetAmount: string;
  targetDate: string | null;
}

/** Only the fields that differ from the saved goal; a blank description means "none". */
export function goalChanges(goal: Pick<GoalResponse, keyof GoalDraft>, draft: GoalDraft): UpdateGoalRequest {
  const description = draft.description.trim() === '' ? null : draft.description;
  return {
    ...(draft.name !== goal.name ? { name: draft.name } : {}),
    ...(description !== goal.description ? { description } : {}),
    ...(draft.targetAmount !== goal.targetAmount ? { targetAmount: draft.targetAmount } : {}),
    ...(draft.targetDate !== goal.targetDate ? { targetDate: draft.targetDate } : {}),
  };
}
