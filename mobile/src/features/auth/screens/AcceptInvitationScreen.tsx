import { useState } from 'react';
import { View } from 'react-native';
import { UsersRound } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Button, SkeletonList, StateView, Text } from '@/components';
import { useAuth, useTheme } from '@/app/providers';
import { useAcceptInvitationMutation, usePreviewInvitationQuery } from '@/app/store';
import { messageOf, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/utils';
import type { AuthStackScreenProps } from '@/app/navigation';

export function AcceptInvitationScreen({ route, navigation }: AuthStackScreenProps<'AcceptInvitation'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const token = route.params?.token;
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const preview = usePreviewInvitationQuery(token ?? '', { skip: token === undefined });
  const [acceptInvitation] = useAcceptInvitationMutation();

  async function handleAccept() {
    setAccepting(true);
    setAcceptError(null);
    try {
      await acceptInvitation({ token: token as string }).unwrap();
      navigation.popToTop();
    } catch (error) {
      setAcceptError(messageOf(error, t));
    } finally {
      setAccepting(false);
    }
  }

  const renderContent = () => {
    if (token === undefined) {
      return <Text tone="danger">{t('invitations.noTokenError', 'No invitation token was provided.')}</Text>;
    }

    if (preview.isLoading) return <SkeletonList rows={3} />;
    if (preview.isError) {
      return <StateView variant="error" error={preview.error} retryAction={() => void preview.refetch()} />;
    }

    const invitation = preview.data;
    if (invitation === undefined) {
      return <StateView variant="error" error={new Error(t('invitations.notFound', 'Invitation not found.'))} />;
    }

    return (
      <>
        <UsersRound size={40} color={theme.colors.primary} style={{ alignSelf: 'center' }} />
        <Text variant="title" style={{ textAlign: 'center' }}>
          {t('invitations.invitedTo', "You're invited to {{name}}", { name: invitation.walletName })}
        </Text>
        <Text tone="muted" style={{ textAlign: 'center' }}>
          {t('invitations.roleAs', 'As {{role}} — {{description}}', {
            role: ROLE_LABELS[invitation.role],
            description: ROLE_DESCRIPTIONS[invitation.role],
          })}
        </Text>
        <Text tone="faint" style={{ textAlign: 'center' }}>
          {t('invitations.invitedEmail', 'Invited: {{email}}', { email: invitation.invitedEmail })}
        </Text>

        {acceptError !== null ? <Text tone="danger">{acceptError}</Text> : null}

        {isAuthenticated ? (
          <Button
            testID="accept-invitation-submit"
            label={t('invitations.acceptButton', 'Accept invitation')}
            onPress={handleAccept}
            loading={accepting}
            fullWidth
          />
        ) : (
          <>
            <Text tone="muted" style={{ textAlign: 'center' }}>
              {t('invitations.loginPrompt', 'Log in or create an account with this email to accept.')}
            </Text>
            <Button label={t('auth.signInLink', 'Log in')} onPress={() => navigation.navigate('Login')} fullWidth />
            <Button
              label={t('auth.registerButton', 'Create an account')}
              variant="secondary"
              onPress={() => navigation.navigate('Register')}
              fullWidth
            />
          </>
        )}
      </>
    );
  };

  return (
    <View className="flex-1 justify-center" style={{ padding: theme.spacing.xl, gap: theme.spacing.md }}>
      {renderContent()}
    </View>
  );
}
