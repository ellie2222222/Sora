import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import type { AppStackParamList } from '@/app/navigation';
import { takeRememberedInvitation } from './rememberedInvitation.ts';

/** Reopens the invitation a signed-out user was looking at, once signing in has mounted the app stack. */
export function usePendingInvitation(): void {
  const navigation = useNavigation<StackNavigationProp<AppStackParamList>>();

  useEffect(() => {
    const token = takeRememberedInvitation();
    if (token !== null) navigation.navigate('AcceptInvitation', { token });
  }, [navigation]);
}
