import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import type { InvitableRole } from '@finance/contracts';

import { Button, Input, Text } from '../../../components/index.ts';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { messageOf } from '../../../utils/errors.ts';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../../utils/roles.ts';
import { useInviteMember } from '../hooks/useWalletMembers.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

const INVITABLE: InvitableRole[] = ['EDITOR', 'VIEWER'];

/** Common relationships offered as one-tap chips; free text always works too. */
const SUGGESTED_LABELS = ['Girlfriend', 'Boyfriend', 'Partner', 'Mom', 'Dad', 'Sibling', 'Friend'];

export function InviteMemberScreen({ route, navigation }: AppStackScreenProps<'InviteMember'>) {
  const theme = useTheme();
  const { walletId } = route.params;
  const inviteMember = useInviteMember(walletId);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('EDITOR');
  const [relationLabel, setRelationLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    try {
      await inviteMember.mutateAsync({
        email,
        role,
        relationLabel: relationLabel.trim().length > 0 ? relationLabel.trim() : undefined,
      });
      navigation.goBack();
    } catch (submitError) {
      setError(messageOf(submitError));
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
        <Text tone="muted">
          Invite someone by email. They'll see this wallet and can add or view money in it,
          depending on the role you give them.
        </Text>

        <Input
          testID="invite-email"
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <View style={{ gap: theme.spacing.xs }}>
          <Text variant="label" tone="muted">
            How do you know them? (optional)
          </Text>
          <Input
            testID="invite-relation-label"
            placeholder="e.g. Girlfriend"
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
            Role
          </Text>
          {INVITABLE.map((candidate) => (
            <Button
              key={candidate}
              testID={`invite-role-${candidate}`}
              label={`${ROLE_LABELS[candidate]} — ${ROLE_DESCRIPTIONS[candidate]}`}
              variant={role === candidate ? 'primary' : 'secondary'}
              onPress={() => setRole(candidate)}
              fullWidth
            />
          ))}
        </View>

        {error !== null ? <Text tone="danger">{error}</Text> : null}

        <Button
          testID="invite-submit"
          label="Send invitation"
          onPress={handleSubmit}
          loading={inviteMember.isPending}
          disabled={email.trim().length === 0}
          fullWidth
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
