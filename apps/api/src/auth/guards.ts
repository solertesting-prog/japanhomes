import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { COOKIE_CSRF, COOKIE_SESSION, HEADER_CSRF } from '@jpt/shared';
import { parseCookies } from '../common/cookies';
import { CryptoService } from '../common/crypto.service';
import type { AppRequest } from '../common/request-context';
import {
  ALLOW_MFA_PENDING,
  ALLOW_UNVERIFIED_EMAIL,
  INVESTOR_PERMISSIONS,
  IS_PUBLIC,
  PERMISSIONS,
  SKIP_CSRF,
  STAFF,
} from './decorators';
import { SessionService } from './session.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global, default-deny authentication + authorisation.
 * Routes are private unless marked @Public(); permissions are enforced here,
 * never only in the UI.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const flag = <T>(key: string) => this.reflector.getAllAndOverride<T>(key, [ctx.getHandler(), ctx.getClass()]);

    const token = parseCookies(req.headers.cookie)[COOKIE_SESSION];
    if (token) req.auth = (await this.sessions.resolve(token)) ?? undefined;

    if (flag<boolean>(IS_PUBLIC)) return true;

    const auth = req.auth;
    if (!auth) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in to continue' });
    if (!auth.mfaVerified && !flag<boolean>(ALLOW_MFA_PENDING)) {
      throw new UnauthorizedException({ code: 'MFA_REQUIRED', message: 'Enter your authentication code to continue' });
    }
    if (!auth.emailVerified && !flag<boolean>(ALLOW_UNVERIFIED_EMAIL)) {
      throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED', message: 'Verify your email address first' });
    }
    const required = flag<string[]>(PERMISSIONS) ?? [];
    const missing = required.filter((p) => !auth.permissions.has(p));
    if (missing.length) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not have permission to do this' });
    }
    const staffRoute = flag<boolean>(STAFF) || required.some((p) => !INVESTOR_PERMISSIONS.has(p));
    if (staffRoute) {
      const isStaff = [...auth.permissions].some((p) => !INVESTOR_PERMISSIONS.has(p));
      if (!isStaff) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not have permission to do this' });
      if (!auth.mfaEnabled) {
        throw new ForbiddenException({ code: 'STAFF_MFA_REQUIRED', message: 'Enable two-factor authentication to use back-office tools' });
      }
    }
    return true;
  }
}

/**
 * Double-submit CSRF check for cookie-authenticated, state-changing requests.
 * Requests without a session cookie (sign-in, sign-up) and signature-verified
 * webhooks are exempt.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly crypto: CryptoService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    if (SAFE_METHODS.has(req.method)) return true;
    if (this.reflector.getAllAndOverride<boolean>(SKIP_CSRF, [ctx.getHandler(), ctx.getClass()])) return true;
    const cookies = parseCookies(req.headers.cookie);
    if (!cookies[COOKIE_SESSION]) return true;
    const header = req.headers[HEADER_CSRF];
    const expected = cookies[COOKIE_CSRF];
    if (typeof header !== 'string' || !expected || !this.crypto.safeEqual(header, expected)) {
      throw new ForbiddenException({ code: 'CSRF_FAILED', message: 'Security token missing or invalid. Reload the page and try again.' });
    }
    return true;
  }
}
