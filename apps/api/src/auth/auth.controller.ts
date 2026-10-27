import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  registerSchema,
  tokenSchema,
  totpCodeSchema,
} from '@jpt/shared';
import type { Response } from 'express';
import type { z } from 'zod';
import type { AppRequest, AuthContext } from '../common/request-context';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { AllowMfaPending, AllowUnverifiedEmail, CurrentAuth, Public } from './decorators';

const STRICT = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(STRICT)
  @Post('register')
  @HttpCode(202)
  @ApiOperation({ summary: 'Create an account. Same response whether or not the email exists.' })
  async register(@Body(new ZodValidationPipe(registerSchema)) body: z.output<typeof registerSchema>, @Req() req: AppRequest) {
    await this.auth.register(body, req);
    return { status: 'check-email' };
  }

  @Public()
  @Throttle(STRICT)
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body(new ZodValidationPipe(tokenSchema)) body: z.output<typeof tokenSchema>) {
    await this.auth.verifyEmail(body.token);
    return { status: 'verified' };
  }

  @Public()
  @Throttle(STRICT)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Password sign-in. Sets an HttpOnly session cookie and a CSRF cookie.' })
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: z.output<typeof loginSchema>,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.login(body, req, res);
  }

  @AllowMfaPending()
  @AllowUnverifiedEmail()
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(auth, res);
  }

  @AllowMfaPending()
  @AllowUnverifiedEmail()
  @Get('me')
  me(@CurrentAuth() auth: AuthContext) {
    return this.auth.me(auth.userId, !auth.mfaVerified);
  }

  @Post('mfa/setup')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start TOTP setup: returns the secret and an otpauth:// URI for a QR code' })
  mfaSetup(@CurrentAuth() auth: AuthContext) {
    return this.auth.mfaSetup(auth);
  }

  @Throttle(STRICT)
  @Post('mfa/enable')
  @HttpCode(204)
  async mfaEnable(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(totpCodeSchema)) body: z.output<typeof totpCodeSchema>,
    @Req() req: AppRequest,
  ) {
    await this.auth.mfaEnable(auth, body.code, req);
  }

  @AllowMfaPending()
  @Throttle(STRICT)
  @Post('mfa/verify')
  @HttpCode(200)
  mfaVerify(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodValidationPipe(totpCodeSchema)) body: z.output<typeof totpCodeSchema>,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.mfaVerify(auth, body.code, req, res);
  }

  @Public()
  @Throttle(STRICT)
  @Post('password/forgot')
  @HttpCode(202)
  async forgot(@Body(new ZodValidationPipe(passwordResetRequestSchema)) body: z.output<typeof passwordResetRequestSchema>) {
    await this.auth.requestPasswordReset(body.email);
    return { status: 'check-email' };
  }

  @Public()
  @Throttle(STRICT)
  @Post('password/reset')
  @HttpCode(204)
  async reset(@Body(new ZodValidationPipe(passwordResetSchema)) body: z.output<typeof passwordResetSchema>) {
    await this.auth.resetPassword(body.token, body.password);
  }
}
