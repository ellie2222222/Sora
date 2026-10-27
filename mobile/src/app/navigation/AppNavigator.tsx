import { createStackNavigator } from '@react-navigation/stack';
import { useTranslation } from 'react-i18next';

import { AddAccountScreen } from '@/features/accounts';
import { AcceptInvitationScreen } from '@/features/auth';
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
        {/* Transparent over ThemeProvider's backdrop, which eases on a theme switch; nothing sits below Main. */}
        <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false, cardStyle: { backgroundColor: 'transparent' } }} />
        <Stack.Screen name="AddAccount" component={AddAccountScreen} options={transparentModalOptions} />
        <Stack.Screen name="CategoryList" component={CategoryListScreen} options={{ title: t('categories.title') }} />
        <Stack.Screen name="AcceptInvitation" component={AcceptInvitationScreen} options={{ title: t('invitations.title') }} />
      </Stack.Navigator>
    </ModalProvider>
  );
}
