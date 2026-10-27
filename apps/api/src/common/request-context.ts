import type { Request } from 'express';

export interface AuthContext {
  userId: string;
  sessionId: string;
  email: string;
  roles: string[];
  permissions: Set<string>;
  mfaEnabled: boolean;
  mfaVerified: boolean;
  emailVerified: boolean;
}

export type AppRequest = Request & { id?: string; auth?: AuthContext; rawBody?: Buffer };

export function requestMeta(req: AppRequest) {
  return {
    requestId: typeof req.id === 'string' ? req.id : null,
    ip: req.ip,
    userAgent: req.headers['user-agent'] ?? null,
  };
}
