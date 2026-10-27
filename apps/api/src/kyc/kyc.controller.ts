import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { kycStartSchema } from '@jpt/shared';
import { z } from 'zod';
import type { AppRequest, AuthContext } from '../common/request-context';
import { SIGNATURE_HEADER } from '../common/webhook-signature';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentAuth, Public, RequirePermissions, SkipCsrf } from '../auth/decorators';
import { KycService } from './kyc.service';

@ApiTags('kyc')
@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get()
  @ApiOperation({ summary: 'Current identity-verification status and eligibility' })
  status(@CurrentAuth() auth: AuthContext) {
    return this.kyc.status(auth.userId);
  }

  @Post('start')
  @HttpCode(200)
  @ApiOperation({ summary: 'Open a verification case with the configured KYC provider' })
  start(@CurrentAuth() auth: AuthContext, @Body(new ZodValidationPipe(kycStartSchema)) body: z.output<typeof kycStartSchema>) {
    return this.kyc.start(auth, body);
  }
}

const decisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().trim().min(10, 'Explain the decision in at least 10 characters').max(1000),
});
const queueQuerySchema = z.object({ status: z.enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']).default('UNDER_REVIEW') });

@ApiTags('compliance')
@Controller('compliance/kyc')
export class ComplianceController {
  constructor(private readonly kyc: KycService) {}

  @Get()
  @RequirePermissions('kyc:review')
  queue(@Query(new ZodValidationPipe(queueQuerySchema)) q: z.output<typeof queueQuerySchema>) {
    return this.kyc.queue(q.status);
  }

  @Post(':id/decision')
  @HttpCode(200)
  @RequirePermissions('kyc:review')
  decide(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(decisionSchema)) body: z.output<typeof decisionSchema>,
  ) {
    return this.kyc.review(auth, id, body.decision, body.reason);
  }
}

@ApiTags('webhooks')
@Controller('webhooks/kyc')
export class KycWebhookController {
  constructor(private readonly kyc: KycService) {}

  @Public()
  @SkipCsrf()
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'KYC provider callback (HMAC-signed, replay-protected, de-duplicated)' })
  receive(@Req() req: AppRequest) {
    const sig = req.headers[SIGNATURE_HEADER];
    return this.kyc.handleWebhook(req.rawBody, typeof sig === 'string' ? sig : undefined);
  }
}
