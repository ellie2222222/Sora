import { useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Share2 } from 'lucide-react-native';
import { inviteMemberSchema, WalletRole, type InvitableRole, type WalletInvitationCreatedResponse } from '@sora/contracts';

import { Button, Input, Text, ThemedView } from '@/components';
import { useTheme, useToast } from '@/app/providers';
import { useCreateInvitationMutation } from '@/app/store';
import { invitationLink } from '@/features/auth';
import { dayOfDate, formatDay, getRoleDescription, getRoleLabel, issueMessagesByPath, messageOf } from '@/utils';

const INVITABLE: InvitableRole[] = [WalletRole.EDITOR, WalletRole.VIEWER];

/** Common relationships offered as one-tap chips; free text always works too. */
const SUGGESTED_LABELS = ['Girlfriend', 'Boyfriend', 'Partner', 'Mom', 'Dad', 'Sibling', 'Friend'];

export function InviteMemberPanel({ walletId, onSent }: { walletId: string; onSent: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [inviteMember, { isLoading: isInviting }] = useCreateInvitationMutation();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>(WalletRole.EDITOR);
  const [relationLabel, setRelationLabel] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<WalletInvitationCreatedResponse | null>(null);

  async function handleSubmit() {
    setError(null);
    const parsed = inviteMemberSchema.safeParse({
      email,
      role,
      relationLabel: relationLabel.trim().length > 0 ? relationLabel : undefined,
    });
    if (!parsed.success) {
      setFieldErrors(issueMessagesByPath(parsed.error.issues, t));
      return;
    }
    setFieldErrors({});
    try {
      setCreated(await inviteMember({ walletId, body: parsed.data }).unwrap());
    } catch (submitError) {
      setError(messageOf(submitError, t));
    }
  }

  // The server sends no mail (§8.2) and returns the token only now, so this is the one chance to pass it on.
  if (created !== null) {
    const link = invitationLink(created.token);
    const share = async () => {
      try {
        await Share.share({ message: t('invitations.shareMessage', { wallet: created.walletName, link }) });
      } catch {
        showToast(t('invitations.shareFailed'), 'error');
      }
    };
    return (
      <View style={{ gap: theme.spacing.md }} testID="invitation-created">
        <Text weight="semibold">{t('invitations.createdTitle')}</Text>
        <Text tone="muted">{t('invitations.createdBody', { email: created.invitedEmail, date: formatDay(dayOfDate(new Date(created.expiresAt))) })}</Text>
        <ThemedView
          style={{
            padding: theme.spacing.md,
            borderRadius: theme.radius.md,
            borderWidth: theme.borderWidth.thin,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surfaceMuted,
          }}
        >
          <Text selectable numberOfLines={2} testID="invitation-link">
            {link}
          </Text>
        </ThemedView>
        <Button testID="btn-share-invitation" label={t('invitations.shareLink')} icon={Share2} onPress={() => void share()} fullWidth />
        <Button testID="btn-done-invitation" label={t('common.done')} variant="secondary" onPress={onSent} fullWidth />
      </View>
    );
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}
    >
      <Text tone="muted">{t('invitations.inviteHelp')}</Text>

      <Input
        testID="input-invitation-email"
        label={t('auth.emailLabel')}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={(next) => {
          setEmail(next);
          setFieldErrors((prev) => ({ ...prev, email: '' }));
        }}
        error={fieldErrors.email}
      />

      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="label" tone="muted">
          {t('invitations.howDoYouKnow')}
        </Text>
        <Input
          testID="input-invitation-relation-label"
          placeholder={t('invitations.relationPlaceholder')}
          value={relationLabel}
          onChangeText={setRelationLabel}
          error={fieldErrors.relationLabel}
        />
        <View className="flex-row flex-wrap" style={{ gap: theme.spacing.xs }}>
          {SUGGESTED_LABELS.map((label) => (
            <Button
              key={label}
              testID={`btn-invitation-relation-${label}`}
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
            testID={`btn-invitation-role-${candidate}`}
            label={`${getRoleLabel(candidate, t)} — ${getRoleDescription(candidate, t)}`}
            variant={role === candidate ? 'primary' : 'secondary'}
            onPress={() => setRole(candidate)}
            fullWidth
          />
        ))}
      </View>

      {error !== null ? <Text tone="danger">{error}</Text> : null}

      <Button
        testID="btn-submit-invitation"
        label={t('invitations.sendInvitation')}
        onPress={handleSubmit}
        loading={isInviting}
        disabled={email.trim().length === 0}
        fullWidth
      />
    </ScrollView>
  );
}
