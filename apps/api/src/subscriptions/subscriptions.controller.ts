import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { acceptDocumentsSchema, createSubscriptionSchema, HEADER_IDEMPOTENCY } from '@jpt/shared';
import type { z } from 'zod';
import { CurrentAuth, Public, RequirePermissions, SkipCsrf } from '../auth/decorators';
import type { AppRequest, AuthContext } from '../common/request-context';
import { SIGNATURE_HEADER } from '../common/webhook-signature';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Post()
  @RequirePermissions('investment:create')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Create a subscription order and reserve tokens (DEMO offerings: simulated money only)' })
  create(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(createSubscriptionSchema)) body: z.output<typeof createSubscriptionSchema>,
    @Headers(HEADER_IDEMPOTENCY) key: string | undefined,
  ) {
    return this.subs.create(auth, body, key);
  }

  @Get()
  list(@CurrentAuth() auth: AuthContext) {
    return this.subs.list(auth);
  }

  @Get(':id')
  get(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.subs.get(auth, id);
  }

  @Post(':id/accept-documents')
  @HttpCode(200)
  @RequirePermissions('investment:create')
  @ApiOperation({ summary: 'Record acceptance (with document hashes) and open a payment intent' })
  accept(
    @CurrentAuth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(acceptDocumentsSchema)) body: z.output<typeof acceptDocumentsSchema>,
  ) {
    return this.subs.acceptDocuments(auth, id, body.documentIds);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.subs.cancel(auth, id);
  }
}

@ApiTags('webhooks')
@Controller('webhooks/payments')
export class PaymentWebhookController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Public()
  @SkipCsrf()
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Payment provider callback (HMAC-signed, replay-protected, de-duplicated)' })
  receive(@Req() req: AppRequest) {
    const sig = req.headers[SIGNATURE_HEADER];
    return this.subs.handlePaymentWebhook(req.rawBody, typeof sig === 'string' ? sig : undefined);
  }
}
