import { strict as assert } from 'node:assert';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

import { AppError } from '../src/common/app-error.ts';
import { MailService, type OutgoingMail } from '../src/mail/mail.service.ts';
import { integrationSkipReason, registerProbeUser, startTestApi, type ProbeUser, type TestApi } from './support/integration.ts';

const SEND = '/auth/me/email-verification';
const CONFIRM = '/auth/me/email-verification/confirm';

describe('email verification by code (§5.8–§5.9, AUTH-US-05)', { skip: integrationSkipReason() }, () => {
  let api: TestApi;
  let outbox: OutgoingMail[];

  before(async () => {
    api = await startTestApi();
  });

  after(async () => {
    await api?.close();
  });

  beforeEach(() => {
    outbox = [];
    mock.restoreAll();
    mock.method(api.app.get(MailService), 'send', async (mail: OutgoingMail) => {
      outbox.push(mail);
    });
  });

  function codeIn(mail: OutgoingMail | undefined): string {
    const match = mail?.text.match(/\b(\d{6})\b/);
    assert.ok(match, `no code in ${mail?.text}`);
    return match[1]!;
  }

  /** Any six digits other than `code`, so a wrong guess is never right by chance. */
  const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

  async function sendCode(user: ProbeUser): Promise<string> {
    const sent = await api.call('POST', SEND, { token: user.token });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    return codeIn(outbox.at(-1));
  }

  /** Moves the last send and its day's window into the past, as if `interval` had gone by. */
  async function backdate(user: ProbeUser, interval: string): Promise<void> {
    await api.sql(
      'UPDATE email_verifications SET sent_at = sent_at - $2::interval, window_started_at = window_started_at - $2::interval WHERE user_id = $1',
      [user.id, interval],
    );
  }

  it('verifies a password account with the code mailed to it, after which the inbox opens', async () => {
    const user = await registerProbeUser(api, 'verify-happy');
    const inboxBefore = await api.call('GET', '/invitations', { token: user.token });
    assert.equal(inboxBefore.body?.error?.code, 'INVITATION_EMAIL_UNVERIFIED');

    const sent = await api.call('POST', SEND, { token: user.token });
    assert.equal(sent.status, 200);
    assert.equal(sent.body!.data.email, user.email);
    assert.ok(Date.parse(sent.body!.data.expiresAt) > Date.now());
    assert.ok(Date.parse(sent.body!.data.resendAfter) > Date.now());
    assert.deepEqual([outbox.length, outbox[0]!.to], [1, user.email]);
    const code = codeIn(outbox[0]);

    const [stored] = await api.sql<{ code_hash: string; attempts: number }>('SELECT code_hash, attempts FROM email_verifications WHERE user_id = $1', [user.id]);
    assert.ok(stored);
    assert.match(stored.code_hash, /^[0-9a-f]{64}$/);
    assert.ok(!stored.code_hash.includes(code));

    const missed = await api.call('POST', CONFIRM, { token: user.token, body: { code: wrong(code) } });
    assert.deepEqual([missed.status, missed.body?.error?.code], [422, 'EMAIL_VERIFICATION_CODE_INVALID']);

    const confirmed = await api.call('POST', CONFIRM, { token: user.token, body: { code: `${code.slice(0, 3)} ${code.slice(3)}` } });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body!.data.emailVerified, true);

    const me = await api.call('GET', '/auth/me', { token: user.token });
    assert.equal(me.body!.data.emailVerified, true);
    assert.deepEqual(await api.sql('SELECT 1 FROM email_verifications WHERE user_id = $1', [user.id]), []);
    const audited = await api.sql<{ event: string; result: string }>(
      "SELECT event, result FROM audit_logs WHERE actor_id = $1 AND event = 'EMAIL_VERIFIED'",
      [user.id],
    );
    assert.deepEqual(audited, [{ event: 'EMAIL_VERIFIED', result: 'SUCCESS' }]);

    const inboxAfter = await api.call('GET', '/invitations', { token: user.token });
    assert.equal(inboxAfter.status, 200);

    const again = await api.call('POST', SEND, { token: user.token });
    assert.deepEqual([again.status, again.body?.error?.code], [409, 'EMAIL_ALREADY_VERIFIED']);
    const reuse = await api.call('POST', CONFIRM, { token: user.token, body: { code } });
    assert.deepEqual([reuse.status, reuse.body?.error?.code], [409, 'EMAIL_ALREADY_VERIFIED']);
  });

  it('holds a resend back for a minute, then replaces the earlier code', async () => {
    const user = await registerProbeUser(api, 'verify-resend');
    const first = await sendCode(user);

    const tooSoon = await api.call('POST', SEND, { token: user.token });
    assert.deepEqual([tooSoon.status, tooSoon.body?.error?.code], [429, 'RATE_LIMITED']);
    assert.ok(Number(tooSoon.headers['retry-after']) > 0);
    assert.equal(outbox.length, 1);

    await backdate(user, '2 minutes');
    const second = await sendCode(user);
    if (second !== first) {
      const stale = await api.call('POST', CONFIRM, { token: user.token, body: { code: first } });
      assert.equal(stale.body?.error?.code, 'EMAIL_VERIFICATION_CODE_INVALID');
    }
    const confirmed = await api.call('POST', CONFIRM, { token: user.token, body: { code: second } });
    assert.equal(confirmed.status, 200);
  });

  it('mails one code when several sends arrive at once', async () => {
    const user = await registerProbeUser(api, 'verify-send-parallel');
    const answers = await Promise.all(Array.from({ length: 4 }, () => api.call('POST', SEND, { token: user.token })));
    assert.deepEqual(answers.map((answer) => answer.status).sort(), [200, 429, 429, 429]);
    assert.equal(outbox.length, 1);
  });

  it('sends at most five codes in a day, then again once the day is over', async () => {
    const user = await registerProbeUser(api, 'verify-send-cap');
    let fifth: string | undefined;
    for (let send = 1; send <= 5; send += 1) {
      const sent = await api.call('POST', SEND, { token: user.token });
      assert.equal(sent.status, 200, `send ${send}: ${JSON.stringify(sent.body)}`);
      fifth = sent.body!.data.resendAfter;
      await backdate(user, '2 minutes');
    }
    // The fifth answer already points past the day's window, not a minute ahead.
    assert.ok(Date.parse(fifth!) - Date.now() > 60 * 60_000, fifth);

    const capped = await api.call('POST', SEND, { token: user.token });
    assert.deepEqual([capped.status, capped.body?.error?.code], [429, 'RATE_LIMITED']);
    assert.ok(Number(capped.headers['retry-after']) > 60 * 60, String(capped.headers['retry-after']));
    assert.equal(outbox.length, 5);

    await backdate(user, '1 day');
    await sendCode(user);
    const [row] = await api.sql<{ sends_in_window: number }>('SELECT sends_in_window FROM email_verifications WHERE user_id = $1', [user.id]);
    assert.equal(row?.sends_in_window, 1);
  });

  it('spends a code after five guesses, even when the sixth is right', async () => {
    const user = await registerProbeUser(api, 'verify-guesses');
    const code = await sendCode(user);
    for (let guess = 0; guess < 5; guess += 1) {
      const missed = await api.call('POST', CONFIRM, { token: user.token, body: { code: wrong(code) } });
      assert.equal(missed.body?.error?.code, 'EMAIL_VERIFICATION_CODE_INVALID', `guess ${guess + 1}`);
    }
    const late = await api.call('POST', CONFIRM, { token: user.token, body: { code } });
    assert.deepEqual([late.status, late.body?.error?.code], [410, 'EMAIL_VERIFICATION_EXPIRED']);
    const me = await api.call('GET', '/auth/me', { token: user.token });
    assert.equal(me.body!.data.emailVerified, false);
  });

  it('counts parallel guesses one at a time, so they cannot exceed five', async () => {
    const user = await registerProbeUser(api, 'verify-parallel');
    const code = await sendCode(user);
    const answers = await Promise.all(
      Array.from({ length: 8 }, () => api.call('POST', CONFIRM, { token: user.token, body: { code: wrong(code) } })),
    );
    const count = (code: string) => answers.filter((answer) => answer.body?.error?.code === code).length;
    assert.deepEqual([count('EMAIL_VERIFICATION_CODE_INVALID'), count('EMAIL_VERIFICATION_EXPIRED')], [5, 3]);
  });

  it('audits a code confirmed in parallel once', async () => {
    const user = await registerProbeUser(api, 'verify-parallel-right');
    const code = await sendCode(user);
    const answers = await Promise.all(
      Array.from({ length: 4 }, () => api.call('POST', CONFIRM, { token: user.token, body: { code } })),
    );
    assert.ok(answers.some((answer) => answer.status === 200));
    const audited = await api.sql("SELECT 1 FROM audit_logs WHERE actor_id = $1 AND event = 'EMAIL_VERIFIED'", [user.id]);
    assert.equal(audited.length, 1);
  });

  it('refuses an expired code, and confirming with none sent', async () => {
    const user = await registerProbeUser(api, 'verify-expired');
    const none = await api.call('POST', CONFIRM, { token: user.token, body: { code: '123456' } });
    assert.deepEqual([none.status, none.body?.error?.code], [410, 'EMAIL_VERIFICATION_EXPIRED']);

    const code = await sendCode(user);
    await api.sql(
      "UPDATE email_verifications SET sent_at = now() - interval '1 hour', window_started_at = now() - interval '1 hour', expires_at = now() - interval '1 minute' WHERE user_id = $1",
      [user.id],
    );
    const expired = await api.call('POST', CONFIRM, { token: user.token, body: { code } });
    assert.deepEqual([expired.status, expired.body?.error?.code], [410, 'EMAIL_VERIFICATION_EXPIRED']);
  });

  it('refuses a code that is not six digits, and a caller with no session', async () => {
    const user = await registerProbeUser(api, 'verify-shape');
    for (const code of ['12345', '1234567', 'abcdef']) {
      const refused = await api.call('POST', CONFIRM, { token: user.token, body: { code } });
      assert.deepEqual([refused.status, refused.body?.error?.code], [422, 'VALIDATION_FAILED'], code);
    }
    const anonymous = await api.call('POST', SEND);
    assert.equal(anonymous.status, 401);
  });

  it('answers 503 when the message cannot be delivered, and leaves no code holding the cooldown', async () => {
    const user = await registerProbeUser(api, 'verify-undelivered');
    mock.restoreAll();
    mock.method(api.app.get(MailService), 'send', async () => {
      throw new AppError('EMAIL_DELIVERY_UNAVAILABLE');
    });
    const failed = await api.call('POST', SEND, { token: user.token });
    assert.deepEqual([failed.status, failed.body?.error?.code], [503, 'EMAIL_DELIVERY_UNAVAILABLE']);
    assert.deepEqual(await api.sql('SELECT 1 FROM email_verifications WHERE user_id = $1', [user.id]), []);

    mock.restoreAll();
    mock.method(api.app.get(MailService), 'send', async (mail: OutgoingMail) => {
      outbox.push(mail);
    });
    const retried = await api.call('POST', SEND, { token: user.token });
    assert.equal(retried.status, 200);
  });

  it('proves only the address the code went to', async () => {
    const user = await registerProbeUser(api, 'verify-moved');
    const code = await sendCode(user);
    await api.sql("UPDATE email_verifications SET email = 'someone-else@example.invalid' WHERE user_id = $1", [user.id]);
    const refused = await api.call('POST', CONFIRM, { token: user.token, body: { code } });
    assert.deepEqual([refused.status, refused.body?.error?.code], [410, 'EMAIL_VERIFICATION_EXPIRED']);
  });
});
