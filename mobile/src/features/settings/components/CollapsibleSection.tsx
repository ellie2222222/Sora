import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components';
import { useTheme } from '@/app/providers';

export function SettingsDivider({ inset = false }: { inset?: boolean } = {}) {
  const theme = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor:
          theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : theme.colors.border,
        marginLeft: inset ? 56 : 0,
      }}
    />
  );
}

export function CollapsibleSection({
  testID,
  icon,
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
}: {
  testID?: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  // `style` can never be a function here — see CLAUDE.md Part 7 rule 15.
  const [pressed, setPressed] = useState(false);

  return (
    <View className="bg-transparent">
      <Pressable
        testID={testID}
        onPress={onToggle}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: 14,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: pressed
            ? theme.colors.surfaceMuted
            : isOpen
              ? theme.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.02)'
                : theme.colors.surfaceMuted
              : 'transparent',
        }}
      >
        <View
          className="w-[36px] h-[36px] rounded-sm items-center justify-center"
          style={{ backgroundColor: theme.colors.primaryMuted }}
        >
          {icon}
        </View>

        <View className="flex-1 gap-xxs">
          <Text weight="semibold" style={{ fontSize: 15 }}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {isOpen ? (
          <ChevronDown size={18} color={theme.colors.primary} />
        ) : (
          <ChevronRight size={18} color={theme.colors.textFaint} />
        )}
      </Pressable>

      {isOpen ? (
        <View
          className="p-md gap-md"
          style={{
            backgroundColor:
              theme.mode === 'dark' ? 'rgba(0, 0, 0, 0.25)' : theme.colors.surfaceMuted,
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

