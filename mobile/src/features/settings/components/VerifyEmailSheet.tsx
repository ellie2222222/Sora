import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { MailCheck, Send } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { confirmEmailVerificationSchema, EMAIL_VERIFICATION_CODE_LENGTH, type EmailVerificationSentResponse } from '@sora/contracts';

import { BottomSheetModal, Button, Input, Text } from '@/components';
import { useAuth, useTheme, useToast } from '@/app/providers';
import { formatSavedAt, formatTimeOfDay, isApiError, issueMessagesByPath, messageOf } from '@/utils';

/** Seconds until `instant`, never negative, re-read every second through its last minute. */
function useSecondsUntil(instant: string | null): number {
  const [tick, setTick] = useState(0);
  const parsed = instant === null ? Number.NaN : Date.parse(instant);
  const target = Number.isFinite(parsed) ? parsed : 0;
  const seconds = Math.max(0, Math.ceil((target - Date.now()) / 1000));
  useEffect(() => {
    if (seconds === 0) return;
    const remaining = target - Date.now();
    // Wakes just after the shown number changes; beyond a minute the label shows a clock time, so the
    // next wake-up that matters is the start of the last minute.
    const delay = remaining > 61_000 ? remaining - 60_000 : (remaining % 1000) + 20;
    const timer = setTimeout(() => setTick((count) => count + 1), Math.max(20, delay));
    return () => clearTimeout(timer);
  }, [target, tick, seconds]);
  return seconds;
}

/** Sends the code §5.8 emails and checks it (AUTH-US-05). Opened from the invitations inbox, which needs a verified email. */
export function VerifyEmailSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user, sendEmailVerification, confirmEmailVerification } = useAuth();
  const { showToast } = useToast();
  const [sent, setSent] = useState<EmailVerificationSentResponse | null>(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const resendIn = useSecondsUntil(sent?.resendAfter ?? null);

  useEffect(() => {
    if (!visible) return;
    setSent((previous) => (previous !== null && Date.parse(previous.expiresAt) <= Date.now() ? null : previous));
    setCode('');
    setCodeError(undefined);
    setError(null);
  }, [visible]);

  async function send() {
    setError(null);
    setSending(true);
    try {
      setSent(await sendEmailVerification());
      setCode('');
      setCodeError(undefined);
    } catch (sendError) {
      if (isApiError(sendError) && sendError.code === 'EMAIL_ALREADY_VERIFIED') {
        onClose();
        return;
      }
      setError(messageOf(sendError, t));
    } finally {
      setSending(false);
    }
  }

  async function confirm() {
    setError(null);
    const parsed = confirmEmailVerificationSchema.safeParse({ code });
    if (!parsed.success) {
      setCodeError(issueMessagesByPath(parsed.error.issues, t).code);
      return;
    }
    setConfirming(true);
    try {
      await confirmEmailVerification(parsed.data.code);
      showToast(t('settings.verifyEmail.confirmed'), 'success');
      onClose();
    } catch (confirmError) {
      if (isApiError(confirmError) && confirmError.code === 'EMAIL_VERIFICATION_CODE_INVALID') {
        setCodeError(messageOf(confirmError, t));
      } else {
        setError(messageOf(confirmError, t));
      }
    } finally {
      setConfirming(false);
    }
  }

  const email = sent?.email ?? user?.email ?? '';

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('settings.verifyEmail.title')} closeLabel="cancel" entity="email-verification">
      <View style={{ gap: theme.spacing.md }}>
        {sent === null ? (
          <>
            <Text tone="muted">{t('settings.verifyEmail.sendBody', { email })}</Text>
            {error !== null ? <Text tone="danger">{error}</Text> : null}
            <Button testID="btn-send-email-verification" label={t('settings.verifyEmail.send')} icon={Send} onPress={send} loading={sending} fullWidth />
          </>
        ) : (
          <>
            <Text tone="muted">{t('settings.verifyEmail.sentBody', { email, time: formatTimeOfDay(sent.expiresAt) })}</Text>
            <Input
              testID="input-email-verification-code"
              label={t('settings.verifyEmail.codeLabel')}
              value={code}
              // Input formats a number pad as money ("929,343"); a code is digits only.
              onChangeText={(next) => {
                setCode(next.replace(/\D/g, ''));
                setCodeError(undefined);
              }}
              error={codeError}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={EMAIL_VERIFICATION_CODE_LENGTH}
              autoFocus
            />
            {error !== null ? <Text tone="danger">{error}</Text> : null}
            <Button
              testID="btn-submit-email-verification"
              label={t('settings.verifyEmail.confirm')}
              icon={MailCheck}
              onPress={confirm}
              loading={confirming}
              disabled={code.trim().length === 0}
              fullWidth
            />
            <Button
              testID="btn-resend-email-verification"
              variant="ghost"
              label={
                resendIn > 60
                  ? t('settings.verifyEmail.resendAt', { time: formatSavedAt(sent.resendAfter) })
                  : resendIn > 0
                    ? t('settings.verifyEmail.resendIn', { seconds: resendIn })
                    : t('settings.verifyEmail.resend')
              }
              onPress={send}
              loading={sending}
              disabled={resendIn > 0}
              fullWidth
            />
          </>
        )}
      </View>
    </BottomSheetModal>
  );
}
