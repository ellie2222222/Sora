import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AcceptInvitationScreen } from '../../features/auth/screens/AcceptInvitationScreen.tsx';
import { LoginScreen } from '../../features/auth/screens/LoginScreen.tsx';
import { RegisterScreen } from '../../features/auth/screens/RegisterScreen.tsx';
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
