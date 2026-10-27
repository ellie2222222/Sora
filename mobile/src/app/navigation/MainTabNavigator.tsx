import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarRange, LayoutDashboard, PieChart, Settings as SettingsIcon, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AiChatScreen } from '@/features/chat';
import { usePendingInvitation } from '@/features/auth';
import { PlanningScreen } from '@/features/planning';
import { HomeScreen } from '@/features/home';
import { DashboardScreen } from '@/features/dashboard';
import { SettingsScreen } from '@/features/settings';
import { Text, ThemedIcon, ThemedView } from '@/components';
import { useTheme } from '@/app/providers';
import type { MainTabParamList } from './types.ts';

const Tab = createBottomTabNavigator<MainTabParamList>();

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);

  const reduceMotion = useReducedMotion();
  // The position lives only on the UI thread. A React prop for it would commit a frame before the
  // animation that leaves the old tab, painting the bar once at the new tab before it slides.
  const position = useSharedValue(0);
  const placed = useRef(false);

  const totalTabs = state.routes.length;
  const indicatorWidth = theme.sizes.tabBar.indicatorWidth;
  const tabWidth = containerWidth / (totalTabs || 1);
  const targetX = state.index * tabWidth + (tabWidth - indicatorWidth) / 2;

  useEffect(() => {
    if (containerWidth <= 0) return;
    if (!placed.current || reduceMotion) {
      placed.current = true;
      position.value = targetX;
      return;
    }

    // Eases in as well as out, unlike `SlideSwap`: the bar can cross several tabs, and leaving at full speed reads as a jump.
    position.value = withTiming(targetX, {
      duration: 300,
      easing: Easing.bezier(0.2, 0, 0, 1),
    });
  }, [targetX, containerWidth, reduceMotion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value }],
  }));

  return (
    <ThemedView
      accessibilityRole="tablist"
      className="flex-row relative"
      style={{
        backgroundColor: theme.colors.surface,
        borderTopWidth: theme.borderWidth.thin,
        borderTopColor: theme.colors.border,
        height: theme.sizes.tabBar.height + insets.bottom,
        paddingBottom: insets.bottom,
      }}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== containerWidth) {
          setContainerWidth(w);
        }
      }}
    >
      {state.routes.map((route, index) => {
        const descriptor = descriptors[route.key];
        if (!descriptor) return null;
        const { options } = descriptor;
        const isFocused = state.index === index;

        const label =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        // Icon and label share one colour, so the two halves of a tab never disagree about its state.
        const color = isFocused ? theme.colors.primary : theme.colors.text;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={`tab-${route.name.toLowerCase()}`}
            onPress={onPress}
            onLongPress={onLongPress}
            className="flex-1 items-center justify-center"
            style={{ paddingVertical: theme.spacing.xs }}
          >
            {options.tabBarIcon?.({ focused: isFocused, color, size: theme.iconSize.xxl }) ?? null}
            <Text
              variant="caption"
              // The weight prop, not a numeric fontWeight: Mulish ships one file per weight, so Android ignores the number.
              weight={isFocused ? 'bold' : 'medium'}
              // A fixed column per tab: xs keeps "Einstellungen" whole, and xs text reads only at full strength.
              style={{ color, fontSize: theme.fontSize.xs, marginTop: theme.spacing.xxs }}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}

      {containerWidth > 0 && (
        <Animated.View
          style={[
            styles.activeIndicator,
            {
              backgroundColor: theme.colors.primary,
              left: 0,
              width: indicatorWidth,
              height: theme.borderWidth.thick,
              borderRadius: theme.radius.pill,
              bottom: insets.bottom + theme.spacing.xxs,
            },
            indicatorStyle,
            theme.motion.colorTransition,
          ]}
        />
      )}
    </ThemedView>
  );
}

export function MainTabNavigator() {
  const theme = useTheme();
  const { t } = useTranslation();
  usePendingInvitation();

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // A visited tab stays mounted; frozen while hidden, it skips a theme or wallet change until shown again,
        // instead of every tab re-rendering on top of the visible one.
        freezeOnBlur: true,
        // Shows ThemeProvider's backdrop, which eases on a theme switch; only the focused tab is ever drawn.
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.text,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t('nav.home'),
          tabBarIcon: ({ color, size }) => <ThemedIcon icon={LayoutDashboard} color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Planning"
        component={PlanningScreen}
        options={{
          tabBarLabel: t('nav.planning', 'Planning'),
          tabBarIcon: ({ color, size }) => <ThemedIcon icon={CalendarRange} color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Ai"
        component={AiChatScreen}
        options={{
          tabBarLabel: t('nav.ai'),
          tabBarIcon: ({ color, size }) => <ThemedIcon icon={Sparkles} color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: t('nav.dashboard'),
          tabBarIcon: ({ color, size }) => <ThemedIcon icon={PieChart} color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: t('settings.title'),
          tabBarIcon: ({ color, size }) => <ThemedIcon icon={SettingsIcon} color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  activeIndicator: {
    position: 'absolute',
  },
});

