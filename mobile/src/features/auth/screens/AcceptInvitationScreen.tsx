import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, AtSign, CalendarClock, Check, LogIn, MailOpen, ShieldCheck, UserPlus, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AnimatedScreen, Button, Card, Skeleton, StateView, Text, ThemedIcon } from '@/components';
import { useAuth, useTheme, useToast } from '@/app/providers';
import { useAcceptInvitationMutation, usePreviewInvitationQuery } from '@/app/store';
import { dayOfDate, formatDay, getRoleDescription, getRoleLabel, isNetworkError, isServerFault, messageOf } from '@/utils';
import type { AppStackScreenProps, AuthStackParamList, AuthStackScreenProps } from '@/app/navigation';
import { rememberInvitation } from '../rememberedInvitation.ts';

/** Opened by an invitation link (`invitationLink`), signed out from the auth stack or signed in from the app stack. */
export function AcceptInvitationScreen({
  route,
  navigation,
}: AuthStackScreenProps<'AcceptInvitation'> | AppStackScreenProps<'AcceptInvitation'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { isAuthenticated, isGuest, exitGuestModeToAuth } = useAuth();
  const token = route.params?.token;
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const preview = usePreviewInvitationQuery(token ?? '', { skip: token === undefined });
  const [acceptInvitation] = useAcceptInvitationMutation();

  // Leaving after an accept, or from a link opened before its stack's start was beneath it.
  const goHome = () =>
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: isAuthenticated || isGuest ? 'Main' : 'Login' }] }));
  const leave = () => (navigation.canGoBack() ? navigation.goBack() : goHome());

  const backAction = { label: t('common.back'), icon: ArrowLeft, onPress: leave };

  async function handleAccept() {
    setAccepting(true);
    setAcceptError(null);
    try {
      const wallet = await acceptInvitation({ token: token as string }).unwrap();
      showToast(t('settings.invitations.joined', { wallet: wallet.name }), 'success');
      goHome();
    } catch (error) {
      setAcceptError(messageOf(error, t));
    } finally {
      setAccepting(false);
    }
  }

  const renderContent = () => {
    if (token === undefined) {
      return <StateView variant="error" title={t('invitations.noTokenError')} primaryAction={backAction} testID="invitation-no-token" />;
    }

    if (preview.isLoading) {
      return (
        <View style={{ gap: theme.spacing.xl, alignItems: 'center', paddingVertical: theme.spacing.xl }}>
          <Skeleton width={theme.iconSize.hero} height={theme.iconSize.hero} radius={theme.radius.pill} />
          <View style={{ gap: theme.spacing.md, alignItems: 'center', width: '100%' }}>
            <Skeleton width="80%" height={theme.sizes.skeletonLine.title} radius={theme.radius.sm} />
            <Skeleton width="60%" height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
          </View>
          <Skeleton width="100%" height={theme.sizes.controlHeight} radius={theme.radius.md} />
        </View>
      );
    }

    if (preview.isError) {
      // Retrying only helps when the server didn't answer; an expired or revoked invitation stays that way.
      const retryable = isNetworkError(preview.error) || isServerFault(preview.error);
      return (
        <StateView
          variant="error"
          error={preview.error}
          retryAction={retryable ? () => void preview.refetch() : undefined}
          primaryAction={retryable ? undefined : backAction}
          testID="invitation-error"
        />
      );
    }

    const invitation = preview.data;
    if (invitation === undefined) {
      return <StateView variant="error" title={t('invitations.notFound')} primaryAction={backAction} testID="invitation-not-found" />;
    }

    return (
      <>
        <Card elevated style={{ gap: theme.spacing.lg }} testID="invitation-letter">
          <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
            <View
              style={{
                width: theme.sizes.emblem,
                height: theme.sizes.emblem,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.colors.primaryMuted,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: theme.spacing.xs,
              }}
            >
              <ThemedIcon icon={MailOpen} size={theme.iconSize.hero} color={theme.colors.primary} />
            </View>
            <Text variant="caption" tone="muted">
              {t('invitations.letterFrom', { name: invitation.inviterName })}
            </Text>
            <Text variant="title" style={{ textAlign: 'center' }}>
              {t('invitations.joinWallet', { name: invitation.walletName })}
            </Text>
            <Text tone="muted" style={{ textAlign: 'center' }}>
              {t('invitations.letterBody', { name: invitation.inviterName })}
            </Text>
          </View>

          <View style={{ height: theme.borderWidth.thin, backgroundColor: theme.colors.border }} />

          <View style={{ gap: theme.spacing.md }}>
            <LetterDetail
              icon={ShieldCheck}
              label={t('invitations.detailRole')}
              value={getRoleLabel(invitation.role, t)}
              hint={getRoleDescription(invitation.role, t)}
            />
            <LetterDetail icon={AtSign} label={t('invitations.detailSentTo')} value={invitation.invitedEmail} />
            <LetterDetail
              icon={CalendarClock}
              label={t('invitations.detailValidUntil')}
              value={formatDay(dayOfDate(new Date(invitation.expiresAt)))}
            />
          </View>
        </Card>

        {acceptError !== null ? (
          <Text tone="danger" testID="invitation-accept-error">
            {acceptError}
          </Text>
        ) : null}

        {isAuthenticated ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              testID="btn-accept-invitation"
              label={t('invitations.acceptButton')}
              icon={Check}
              onPress={handleAccept}
              loading={accepting}
              fullWidth
            />
            <Button testID="btn-dismiss-invitation" label={t('invitations.notNow')} variant="ghost" onPress={leave} fullWidth />
          </View>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            <Text tone="muted" style={{ textAlign: 'center' }}>
              {t('invitations.loginPrompt', { email: invitation.invitedEmail })}
            </Text>
            {isGuest ? (
              <Button
                testID="btn-open-login"
                label={t('auth.signInLink')}
                icon={LogIn}
                onPress={() => {
                  rememberInvitation(token);
                  void exitGuestModeToAuth();
                }}
                fullWidth
              />
            ) : (
              <SignedOutActions token={token} />
            )}
          </View>
        )}
      </>
    );
  };

  return (
    <AnimatedScreen testID="screen-accept-invitation" style={{ backgroundColor: theme.colors.background }}>
      <ScrollView
        contentContainerClassName="flex-grow justify-center"
        contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.md }}
      >
        {renderContent()}
      </ScrollView>
    </AnimatedScreen>
  );
}

function LetterDetail({ icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
      <ThemedIcon icon={icon} size={theme.iconSize.xl} color={theme.colors.textMuted} style={{ marginTop: theme.spacing.xxs }} />
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        <Text weight="semibold">{value}</Text>
        {hint !== undefined ? (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Rendered only in the auth stack, where Login and Register live. */
function SignedOutActions({ token }: { token: string }) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();

  return (
    <>
      <Button
        testID="btn-open-login"
        label={t('auth.signInLink')}
        icon={LogIn}
        onPress={() => {
          rememberInvitation(token);
          navigation.navigate('Login');
        }}
        fullWidth
      />
      <Button
        testID="btn-open-register"
        label={t('auth.registerButton')}
        icon={UserPlus}
        variant="secondary"
        onPress={() => {
          rememberInvitation(token);
          navigation.navigate('Register');
        }}
        fullWidth
      />
    </>
  );
}
