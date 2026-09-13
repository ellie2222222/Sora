import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Landmark, LayoutDashboard, PieChart, Settings as SettingsIcon, Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountsScreen } from '../../features/accounts/screens/AccountsScreen.tsx';
import { GoalsScreen } from '../../features/goals/screens/GoalsScreen.tsx';
import { HomeScreen } from '../../features/dashboard/screens/HomeScreen.tsx';
import { ReportScreen } from '../../features/reports/screens/ReportScreen.tsx';
import { SettingsScreen } from '../../features/settings/screens/SettingsScreen.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import { TAB_BAR_HEIGHT } from './tabBarMetrics.ts';
import type { MainTabParamList } from './types.ts';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Home | Account | Goals | Report | Settings */
export function MainTabNavigator() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textFaint,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: TAB_BAR_HEIGHT + insets.bottom,
        },
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
        name="Goals"
        component={GoalsScreen}
        options={{
          tabBarLabel: t('nav.goals'),
          tabBarIcon: ({ color, size }) => <Target color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Report"
        component={ReportScreen}
        options={{
          tabBarLabel: t('nav.report'),
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
