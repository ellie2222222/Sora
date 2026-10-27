import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';

import { AppError } from '../common/app-error.ts';
import { CONFIG, type AppConfig } from '../config/env.ts';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    this.transport = config.SMTP_URL ? nodemailer.createTransport(config.SMTP_URL) : null;
  }

  /** Production without SMTP_URL has nowhere to deliver; anywhere else the outbox stands in. */
  get canDeliver(): boolean {
    return this.transport !== null || this.config.NODE_ENV !== 'production';
  }

  async send(mail: OutgoingMail): Promise<void> {
    if (this.transport !== null) {
      try {
        await this.transport.sendMail({ from: this.config.MAIL_FROM, ...mail });
      } catch (error) {
        this.logger.warn(`SMTP delivery failed: ${error instanceof Error ? error.message : String(error)}`);
        throw new AppError('EMAIL_DELIVERY_UNAVAILABLE');
      }
      return;
    }
    if (!this.canDeliver) throw new AppError('EMAIL_DELIVERY_UNAVAILABLE');

    const outbox = resolve(this.config.MAIL_OUTBOX_DIR);
    await mkdir(outbox, { recursive: true });
    const file = join(outbox, `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.txt`);
    await writeFile(file, `From: ${this.config.MAIL_FROM}\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n`, 'utf8');
    this.logger.log(`No SMTP_URL: wrote the message to ${file}`);
  }

  onModuleDestroy(): void {
    this.transport?.close();
  }
}
