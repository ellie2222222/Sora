import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarRange, LayoutDashboard, PieChart, Settings as SettingsIcon, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AiChatScreen } from '@/features/chat';
import { PlanningScreen } from '@/features/planning';
import { HomeScreen } from '@/features/home';
import { DashboardScreen } from '@/features/dashboard';
import { SettingsScreen } from '@/features/settings';
import { useTheme } from '@/app/providers';
import type { MainTabParamList } from './types.ts';

const Tab = createBottomTabNavigator<MainTabParamList>();

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);

  const translateX = useSharedValue(0);
  const isInitialized = useSharedValue(false);

  const totalTabs = state.routes.length;
  const indicatorWidth = theme.sizes.tabBar.indicatorWidth;
  const tabWidth = containerWidth / (totalTabs || 1);

  useEffect(() => {
    if (containerWidth <= 0) return;

    const targetX = state.index * tabWidth + (tabWidth - indicatorWidth) / 2;

    if (!isInitialized.value) {
      translateX.value = targetX;
      isInitialized.value = true;
    } else {
      // Decelerates onto the tab and stops dead — the same horizontal-motion
      // treatment as `SlideSwap`, rather than springing past it and back.
      translateX.value = withTiming(targetX, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [state.index, containerWidth, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
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

        const color = isFocused ? theme.colors.primary : theme.colors.textFaint;

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
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={`tab-${route.name.toLowerCase()}`}
            onPress={onPress}
            onLongPress={onLongPress}
            className="flex-1 items-center justify-center"
            style={{ paddingVertical: theme.spacing.xs }}
          >
            {options.tabBarIcon ? (
              options.tabBarIcon({ focused: isFocused, color, size: theme.iconSize.xxl })
            ) : null}
            <Text
              className="text-xs"
              style={{
                color,
                marginTop: theme.spacing.xxs,
                fontWeight: isFocused ? theme.fontWeight.semibold : theme.fontWeight.regular,
              }}
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
              width: indicatorWidth,
              height: theme.borderWidth.thick,
              borderRadius: theme.radius.pill,
              bottom: insets.bottom + theme.spacing.xxs,
            },
            indicatorStyle,
          ]}
        />
      )}
    </View>
  );
}

export function MainTabNavigator() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textFaint,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t('nav.home'),
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Planning"
        component={PlanningScreen}
        options={{
          tabBarLabel: t('nav.planning', 'Planning'),
          tabBarIcon: ({ color, size }) => <CalendarRange color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Ai"
        component={AiChatScreen}
        options={{
          tabBarLabel: t('nav.ai'),
          tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: t('nav.dashboard'),
          tabBarIcon: ({ color, size }) => <PieChart color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: t('settings.title'),
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} />,
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

