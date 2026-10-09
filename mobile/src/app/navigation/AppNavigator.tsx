import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { AddAccountScreen } from '@/features/accounts';
import { AddBudgetModal } from '@/features/budgets';
import { CategoryListScreen } from '@/features/categories';

import { ModalProvider } from '../providers/ModalProvider.tsx';
import { MainTabNavigator } from './MainTabNavigator.tsx';
import type { AppStackParamList } from './types.ts';

const Stack = createStackNavigator<AppStackParamList>();

const transparentModalOptions = {
  headerShown: false,
  presentation: 'transparentModal' as const,
  detachPreviousScreen: false,
  cardStyle: { backgroundColor: 'transparent' },
};

/**
 * Uses JS Stack Navigator (@react-navigation/stack) so transparentModal routes
 * do not detach or hide the underlying main tab screen in the DOM.
 */
export function AppNavigator() {
  const { t } = useTranslation();

  return (
    <ModalProvider>
      <Stack.Navigator>
      <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />

      <Stack.Screen name="AddAccount" component={AddAccountScreen} options={transparentModalOptions} />

      <Stack.Screen name="CategoryList" component={CategoryListScreen} options={{ title: t('categories.title') }} />





    </Stack.Navigator>
    </ModalProvider>
  );
}
