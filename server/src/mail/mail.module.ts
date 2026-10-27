import { Module } from '@nestjs/common';

import { MailService } from './mail.service.ts';

@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
