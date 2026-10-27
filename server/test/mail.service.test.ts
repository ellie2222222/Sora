import { strict as assert } from 'node:assert';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { loadConfig } from '../src/config/env.ts';
import { MailService } from '../src/mail/mail.service.ts';
import { verificationEmail } from '../src/mail/verification-email.ts';

const BASE_ENV = {
  DATABASE_URL: 'postgresql://unused@127.0.0.1:9/unused',
  JWT_SECRET: 'mail-test-secret-not-a-credential-000000',
  GOOGLE_CLIENT_ID: 'mail-test.apps.googleusercontent.com',
};

describe('MailService', () => {
  it('has nowhere to deliver in production without SMTP_URL', async () => {
    const mail = new MailService(loadConfig({ ...BASE_ENV, NODE_ENV: 'production' }));
    assert.equal(mail.canDeliver, false);
    await assert.rejects(mail.send({ to: 'a@example.invalid', subject: 's', text: 't' }), { code: 'EMAIL_DELIVERY_UNAVAILABLE' });
  });

  it('writes the message to the outbox outside production', async () => {
    const outbox = await mkdtemp(join(tmpdir(), 'sora-mail-test-'));
    try {
      const mail = new MailService(loadConfig({ ...BASE_ENV, NODE_ENV: 'development', MAIL_OUTBOX_DIR: outbox }));
      assert.equal(mail.canDeliver, true);
      await mail.send(verificationEmail('a@example.invalid', 'vi', '042317', 15));
      const [file, ...rest] = await readdir(outbox);
      assert.equal(rest.length, 0);
      const text = await readFile(join(outbox, file!), 'utf8');
      assert.match(text, /^To: a@example\.invalid$/m);
      assert.match(text, /042317/);
      assert.match(text, /15 phút/);
    } finally {
      await rm(outbox, { recursive: true, force: true });
    }
  });

  it('refuses an SMTP_URL that is not smtp:// or smtps://', () => {
    assert.throws(() => loadConfig({ ...BASE_ENV, SMTP_URL: 'http://mail.example.invalid' }), /SMTP_URL/);
  });
});
