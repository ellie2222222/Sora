import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { DatePresetSheetProps } from '@/components';
import { useWallets } from '@/app/providers';
import { today } from '@/utils';
import { goalDeadlinePresets } from '../goalDeadlines.ts';

/** The deadline sheet's options, shared by the add sheet and the edit card. */
export function useGoalDeadlineSheet(): Omit<DatePresetSheetProps, 'visible' | 'value' | 'onSelect' | 'onClose'> {
  const { t } = useTranslation();
  const { timeZone } = useWallets();
  const day = today(timeZone);

  return useMemo(
    () => ({
      title: t('goals.deadline'),
      prompt: t('goals.deadlineQuestion'),
      presets: goalDeadlinePresets(day).map(({ preset, day: presetDay }) => ({
        key: preset,
        label: t(`goals.deadlinePresets.${preset}`),
        day: presetDay,
      })),
      entity: 'goal-deadline',
      today: day,
    }),
    [t, day],
  );
}
