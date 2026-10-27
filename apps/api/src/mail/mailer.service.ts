import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OutgoingMail {
  userId: string;
  to: string;
  type: string;
  subject: string;
  text: string;
  data?: Record<string, string>;
}

/**
 * Port for transactional email. The mock adapter records each message as an
 * EMAIL notification (readable via the dev outbox) and logs it. A real
 * provider (e.g. SES) implements the same `send` in Phase 5.
 */
export abstract class Mailer {
  abstract send(mail: OutgoingMail): Promise<void>;
}

@Injectable()
export class MockMailer extends Mailer {
  private readonly logger = new Logger('MockMailer');

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async send(mail: OutgoingMail): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: mail.userId,
        channel: 'EMAIL',
        type: mail.type,
        title: mail.subject,
        body: mail.text,
        data: mail.data ?? {},
        sentAt: new Date(),
      },
    });
    this.logger.log(`[mock email] to=${mail.to} type=${mail.type} subject="${mail.subject}"`);
  }
}
