import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { UsersRound } from 'lucide-react-native';

import { Button, ErrorState, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { invitationsApi } from '../../../services/api/invitations.ts';
import { useAuth } from '../../../app/providers/AuthProvider.tsx';
import { messageOf } from '../../../utils/errors.ts';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../../utils/roles.ts';
import type { AuthStackScreenProps } from '../../../app/navigation/types.ts';

/**
 * Reached via a deep link carrying the invitation token. Preview is public
 * (API spec §8.4) so the invitee sees what they are being offered before
 * choosing to sign up or log in; acceptance itself requires being authenticated
 * as the invited address (§8.5), which is why this screen also offers login.
 */
export function AcceptInvitationScreen({ route, navigation }: AuthStackScreenProps<'AcceptInvitation'>) {
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const token = route.params?.token;
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const preview = useQuery({
    queryKey: ['invitation-preview', token],
    queryFn: () => invitationsApi.preview(token as string),
    enabled: token !== undefined,
  });

  if (token === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text tone="danger">No invitation token was provided.</Text>
      </View>
    );
  }

  if (preview.isLoading) return <SkeletonList rows={3} />;
  if (preview.isError) {
    return <ErrorState error={preview.error} onRetry={() => void preview.refetch()} />;
  }

  const invitation = preview.data;
  if (invitation === undefined) return null;

  async function handleAccept() {
    setAccepting(true);
    setAcceptError(null);
    try {
      await invitationsApi.accept({ token: token as string });
      // The wallet list refetches on its own (it is not this stack's concern);
      // landing back at the root is enough for the app to pick it up.
      navigation.popToTop();
    } catch (error) {
      setAcceptError(messageOf(error));
    } finally {
      setAccepting(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: theme.spacing.xl, gap: theme.spacing.md, justifyContent: 'center' }}>
      <UsersRound size={40} color={theme.colors.primary} style={{ alignSelf: 'center' }} />
      <Text variant="title" style={{ textAlign: 'center' }}>
        You're invited to {invitation.walletName}
      </Text>
      <Text tone="muted" style={{ textAlign: 'center' }}>
        As {ROLE_LABELS[invitation.role]} — {ROLE_DESCRIPTIONS[invitation.role]}
      </Text>
      <Text tone="faint" style={{ textAlign: 'center' }}>
        Invited: {invitation.invitedEmail}
      </Text>

      {acceptError !== null ? <Text tone="danger">{acceptError}</Text> : null}

      {isAuthenticated ? (
        <Button
          testID="accept-invitation-submit"
          label="Accept invitation"
          onPress={handleAccept}
          loading={accepting}
          fullWidth
        />
      ) : (
        <>
          <Text tone="muted" style={{ textAlign: 'center' }}>
            Log in or create an account with this email to accept.
          </Text>
          <Button label="Log in" onPress={() => navigation.navigate('Login')} fullWidth />
          <Button
            label="Create an account"
            variant="secondary"
            onPress={() => navigation.navigate('Register')}
            fullWidth
          />
        </>
      )}
    </View>
  );
}
