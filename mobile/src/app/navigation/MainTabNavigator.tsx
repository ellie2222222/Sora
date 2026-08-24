import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CirclePlus, LayoutDashboard, PiggyBank, Receipt, Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { HomeScreen } from '../../features/dashboard/screens/HomeScreen.tsx';
import { AddTransactionScreen } from '../../features/transactions/screens/AddTransactionScreen.tsx';
import { TransactionsScreen } from '../../features/transactions/screens/TransactionsScreen.tsx';
import { BudgetsScreen } from '../../features/budgets/screens/BudgetsScreen.tsx';
import { GoalsScreen } from '../../features/goals/screens/GoalsScreen.tsx';
import { useTheme } from '../providers/ThemeProvider.tsx';
import type { MainTabParamList } from './types.ts';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Plan §9's layout: Home | Transactions | + | Budgets | Goals. */
export function MainTabNavigator() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textFaint,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
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
        name="Transactions"
        component={TransactionsScreen}
        options={{
          tabBarLabel: t('nav.transactions'),
          tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{
          tabBarLabel: t('nav.add'),
          tabBarIcon: ({ color, size }) => <CirclePlus color={color} size={size + 6} />,
        }}
      />
      <Tab.Screen
        name="Budgets"
        component={BudgetsScreen}
        options={{
          tabBarLabel: t('nav.budgets'),
          tabBarIcon: ({ color, size }) => <PiggyBank color={color} size={size} />,
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
    </Tab.Navigator>
  );
}
