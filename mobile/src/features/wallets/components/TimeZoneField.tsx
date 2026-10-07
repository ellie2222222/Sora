import { Check, ChevronDown, Globe } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BottomSheetModal, Input, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { deviceTimeZone } from '@/utils';
import { timeZoneLabel, timeZoneOptions } from '../timeZones.ts';

/** Rows rendered at once; the search narrows the rest. */
const VISIBLE_OPTIONS = 60;

export interface TimeZoneFieldProps {
  value: string;
  onChange: (zone: string) => void;
  testID?: string;
}

/** The wallet's calendar zone: which day and month every transaction in it falls on, for every member. */
export function TimeZoneField({ value, onChange, testID = 'picker-time-zone' }: TimeZoneFieldProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pressedZone, setPressedZone] = useState<string | null>(null);
  const device = deviceTimeZone();
  const options = useMemo(() => timeZoneOptions([value, device], query).slice(0, VISIBLE_OPTIONS), [value, device, query]);

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="label" tone="muted">
        {t('wallets.timeZone')}
      </Text>
      <Pressable
        testID={testID}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${t('wallets.timeZone')}, ${timeZoneLabel(value)}`}
        style={{
          height: theme.sizes.controlHeight,
          borderRadius: theme.radius.md,
          borderWidth: theme.borderWidth.thin,
          borderColor: theme.colors.borderControl,
          backgroundColor: theme.colors.surface,
          paddingHorizontal: theme.spacing.md,
          justifyContent: 'center',
        }}
      >
        <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
          <Globe size={theme.iconSize.lg} color={theme.colors.textMuted} />
          <Text numberOfLines={1} style={{ flex: 1 }}>
            {timeZoneLabel(value)}
          </Text>
          <ChevronDown size={theme.iconSize.lg} color={theme.colors.textMuted} />
        </View>
      </Pressable>
      <Text variant="caption" tone="muted">
        {t('wallets.timeZoneHint')}
      </Text>

      <BottomSheetModal visible={open} onClose={() => setOpen(false)} title={t('wallets.timeZone')} entity="time-zone">
        <View style={{ gap: theme.spacing.sm, paddingBottom: theme.spacing.md }}>
          <Input
            testID="input-time-zone-search"
            placeholder={t('wallets.timeZoneSearch')}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: theme.sizes.listMaxHeight.md }}
          >
            {options.map((zone) => {
              const selected = zone === value;
              return (
                <Pressable
                  key={zone}
                  testID={`option-time-zone-${zone}`}
                  onPressIn={() => setPressedZone(zone)}
                  onPressOut={() => setPressedZone(null)}
                  onPress={() => {
                    onChange(zone);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: theme.sizes.controlHeight,
                    paddingHorizontal: theme.spacing.sm,
                    borderRadius: theme.radius.md,
                    backgroundColor: selected
                      ? theme.colors.primaryMuted
                      : pressedZone === zone
                        ? theme.colors.surfaceMuted
                        : 'transparent',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text weight={selected ? 'semibold' : 'regular'}>{timeZoneLabel(zone)}</Text>
                    {zone === device ? (
                      <Text variant="caption" tone="muted">
                        {t('wallets.timeZoneDevice')}
                      </Text>
                    ) : null}
                  </View>
                  {selected ? <Check size={theme.iconSize.md} color={theme.colors.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </BottomSheetModal>
    </View>
  );
}
