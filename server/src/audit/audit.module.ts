import { Global, Module } from '@nestjs/common';

import { AuditService } from './audit.service.ts';

/**
 * Global: every feature service records audit rows, and requiring each of
 * their modules to import this one individually would be pure boilerplate for
 * a service with no state to scope.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
