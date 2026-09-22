import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarRange, Landmark, LayoutDashboard, PieChart, Settings as SettingsIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountsScreen } from '@/features/accounts';
import { PlanningScreen } from '@/features/planning';
import { HomeScreen } from '@/features/home';
import { DashboardScreen } from '@/features/dashboard';
import { SettingsScreen } from '@/features/settings';
import { useTheme } from '@/app/providers';
import { TAB_BAR_HEIGHT } from './tabBarMetrics.ts';
import type { MainTabParamList } from './types.ts';

const Tab = createBottomTabNavigator<MainTabParamList>();

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);

  const translateX = useSharedValue(0);
  const isInitialized = useSharedValue(false);

  const totalTabs = state.routes.length;
  const indicatorWidth = 28;
  const tabWidth = containerWidth / (totalTabs || 1);

  useEffect(() => {
    if (containerWidth <= 0) return;

    const targetX = state.index * tabWidth + (tabWidth - indicatorWidth) / 2;

    if (!isInitialized.value) {
      translateX.value = targetX;
      isInitialized.value = true;
    } else {
      translateX.value = withSpring(targetX, {
        damping: 11,
        stiffness: 120,
        mass: 0.7,
        overshootClamping: false,
      });
    }
  }, [state.index, containerWidth, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      className="flex-row relative border-t"
      style={{
        backgroundColor: theme.colors.surface,
        borderTopColor: theme.colors.border,
        height: TAB_BAR_HEIGHT + insets.bottom,
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
            className="flex-1 items-center justify-center py-[6px]"
          >
            {options.tabBarIcon ? (
              options.tabBarIcon({ focused: isFocused, color, size: 22 })
            ) : null}
            <Text
              className="text-xs mt-[3px]"
              style={{
                color,
                fontWeight: isFocused ? '600' : '400',
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
              bottom: insets.bottom + 3,
            },
            indicatorStyle,
          ]}
        />
      )}
    </View>
  );
}

/** Home | Account | Planning | Dashboard | Settings */
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
        name="Account"
        component={AccountsScreen}
        options={{
          tabBarLabel: t('nav.account'),
          tabBarIcon: ({ color, size }) => <Landmark color={color} size={size} />,
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
    height: 3,
    borderRadius: 2,
  },
});

