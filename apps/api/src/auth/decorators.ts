import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@jpt/database';
import { INVESTOR_PERMISSION_KEYS } from '@jpt/shared';
import type { AppRequest, AuthContext } from '../common/request-context';

export const IS_PUBLIC = 'jpt:public';
export const PERMISSIONS = 'jpt:permissions';
export const ALLOW_MFA_PENDING = 'jpt:allow-mfa-pending';
export const ALLOW_UNVERIFIED_EMAIL = 'jpt:allow-unverified-email';
export const SKIP_CSRF = 'jpt:skip-csrf';
export const STAFF = 'jpt:staff';

/**
 * Permissions an investor account can hold. Anything else is a staff
 * permission, and staff routes require MFA to be enabled on the account.
 */
export const INVESTOR_PERMISSIONS: ReadonlySet<string> = new Set(INVESTOR_PERMISSION_KEYS);

/** Back-office route: needs at least one staff permission and MFA enabled. */
export const Staff = () => SetMetadata(STAFF, true);

/** No session required. The session is still attached if present. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Every listed permission is required (checked in the backend, always). */
export const RequirePermissions = (...permissions: PermissionKey[]) => SetMetadata(PERMISSIONS, permissions);

/** Reachable between password and second factor (MFA verification itself, logout, me). */
export const AllowMfaPending = () => SetMetadata(ALLOW_MFA_PENDING, true);

export const AllowUnverifiedEmail = () => SetMetadata(ALLOW_UNVERIFIED_EMAIL, true);

/** For server-to-server endpoints authenticated by signature (webhooks). */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF, true);

export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.auth) throw new Error('CurrentAuth used on a route without authentication');
  return req.auth;
});
