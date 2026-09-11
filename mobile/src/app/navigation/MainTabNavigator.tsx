import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Landmark, LayoutDashboard, PieChart, Settings as SettingsIcon, Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fab } from '../../components/index.ts';
import { AccountsScreen } from '../../features/accounts/screens/AccountsScreen.tsx';
import { GoalsScreen } from '../../features/goals/screens/GoalsScreen.tsx';
import { HomeScreen } from '../../features/dashboard/screens/HomeScreen.tsx';
import { ReportScreen } from '../../features/reports/screens/ReportScreen.tsx';
import { SettingsScreen } from '../../features/settings/screens/SettingsScreen.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import type { AppStackScreenProps, MainTabParamList } from './types.ts';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_BAR_HEIGHT = 56;

/** Plan's redesigned IA: Home | Account | Goals | Report | Settings, plus a floating add-transaction FAB. */
export function MainTabNavigator() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AppStackScreenProps<'Main'>['navigation']>();

  return (
    <View style={{ flex: 1 }}>
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

      <Fab
        style={{ position: 'absolute', alignSelf: 'center', bottom: TAB_BAR_HEIGHT + insets.bottom + theme.spacing.sm }}
        onPress={() => navigation.navigate('AddTransaction')}
      />
    </View>
  );
}
