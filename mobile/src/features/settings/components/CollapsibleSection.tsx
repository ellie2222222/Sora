import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components';
import { useTheme } from '@/app/providers';

export function SettingsDivider() {
  const theme = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
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
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: pressed || isOpen ? theme.colors.surfaceMuted : 'transparent',
        }}
      >
        <View className="items-center justify-center" style={{ width: theme.iconSize.xl }}>
          {icon}
        </View>

        <View className="flex-1 gap-xxs">
          <Text weight="semibold">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {isOpen ? (
          <ChevronDown size={theme.iconSize.lg} color={theme.colors.primary} />
        ) : (
          <ChevronRight size={theme.iconSize.lg} color={theme.colors.textFaint} />
        )}
      </Pressable>

      {isOpen ? (
        <View
          className="p-md gap-md"
          style={{ backgroundColor: theme.colors.surfaceInset }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

