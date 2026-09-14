import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WalletRole, type InvitableRole } from '@sora/contracts';

import { Button, Input, Text } from '../../../components/index.ts';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useCreateInvitationMutation } from '../../../app/store/api/invitationsApi.ts';
import { messageOf } from '../../../utils/errors.ts';
import { getRoleDescription, getRoleLabel } from '../../../utils/roles.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

const INVITABLE: InvitableRole[] = [WalletRole.EDITOR, WalletRole.VIEWER];

/** Common relationships offered as one-tap chips; free text always works too. */
const SUGGESTED_LABELS = ['Girlfriend', 'Boyfriend', 'Partner', 'Mom', 'Dad', 'Sibling', 'Friend'];

export function InviteMemberScreen({ route, navigation }: AppStackScreenProps<'InviteMember'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { walletId } = route.params;
  const [inviteMember, { isLoading: isInviting }] = useCreateInvitationMutation();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>(WalletRole.EDITOR);
  const [relationLabel, setRelationLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    try {
      await inviteMember({
        walletId,
        body: {
          email,
          role,
          relationLabel: relationLabel.trim().length > 0 ? relationLabel.trim() : undefined,
        },
      }).unwrap();
      navigation.goBack();
    } catch (submitError) {
      setError(messageOf(submitError, t));
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
        <Text tone="muted">
          {t('invitations.inviteHelp')}
        </Text>

        <Input
          testID="invite-email"
          label={t('auth.emailLabel')}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" tone="muted">
            {t('invitations.howDoYouKnow')}
          </Text>
          <Input
            testID="invite-relation-label"
            placeholder={t('invitations.relationPlaceholder')}
            value={relationLabel}
            onChangeText={setRelationLabel}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            {SUGGESTED_LABELS.map((label) => (
              <Button
                key={label}
                testID={`invite-relation-chip-${label}`}
                label={label}
                size="sm"
                variant={relationLabel === label ? 'primary' : 'secondary'}
                onPress={() => setRelationLabel(label)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('invitations.role')}
          </Text>
          {INVITABLE.map((candidate) => (
            <Button
              key={candidate}
              testID={`invite-role-${candidate}`}
              label={`${getRoleLabel(candidate, t)} — ${getRoleDescription(candidate, t)}`}
              variant={role === candidate ? 'primary' : 'secondary'}
              onPress={() => setRole(candidate)}
              fullWidth
            />
          ))}
        </View>

        {error !== null ? <Text tone="danger">{error}</Text> : null}

        <Button
          testID="invite-submit"
          label={t('invitations.sendInvitation')}
          onPress={handleSubmit}
          loading={isInviting}
          disabled={email.trim().length === 0}
          fullWidth
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
