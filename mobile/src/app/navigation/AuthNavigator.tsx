import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AcceptInvitationScreen, LoginScreen, RegisterScreen } from '@/features/auth';
import type { AuthStackParamList } from './types.ts';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen
        name="AcceptInvitation"
        component={AcceptInvitationScreen}
        options={{ headerShown: true, title: 'Invitation' }}
      />
    </Stack.Navigator>
  );
}
