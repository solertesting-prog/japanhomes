import { Global, Module } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { Mailer, MockMailer } from '../mail/mailer.service';
import { CryptoService } from './crypto.service';

@Global()
@Module({
  providers: [CryptoService, AuditService, { provide: Mailer, useClass: MockMailer }],
  exports: [CryptoService, AuditService, Mailer],
})
export class CommonModule {}
