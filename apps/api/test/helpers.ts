import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { stableId } from '@jpt/database';
import { COOKIE_CSRF } from '@jpt/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { totpAt } from '../src/common/totp';
import { loadEnv } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';

export async function createApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const env = loadEnv(process.env);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.register(env)] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true, logger: false });
  app.setGlobalPrefix('v1', { exclude: ['health/live', 'health/ready'] });
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** Minimal browser: keeps cookies and echoes the CSRF cookie like the web app does. */
export class Client {
  private cookies = new Map<string, string>();

  constructor(private readonly app: INestApplication) {}

  private store(res: request.Response): request.Response {
    const set = res.headers['set-cookie'] as unknown as string[] | undefined;
    for (const c of set ?? []) {
      const [pair] = c.split(';');
      const i = pair!.indexOf('=');
      const name = pair!.slice(0, i);
      const value = decodeURIComponent(pair!.slice(i + 1));
      if (/Max-Age=0/i.test(c)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  private header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
  }

  async get(path: string): Promise<request.Response> {
    return this.store(await request(this.app.getHttpServer()).get(path).set('Cookie', this.header()));
  }

  async post(path: string, body: unknown = {}, headers: Record<string, string> = {}, opts: { csrf?: boolean } = {}): Promise<request.Response> {
    const req = request(this.app.getHttpServer()).post(path).set('Cookie', this.header()).set(headers);
    const csrf = this.cookies.get(COOKIE_CSRF);
    if (csrf && opts.csrf !== false) req.set('X-CSRF-Token', csrf);
    return this.store(await req.send(body as object));
  }
}

export const uniqueEmail = (tag: string) => `${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.test`;

export async function latestEmailToken(app: INestApplication, email: string, type: string): Promise<string> {
  const res = await request(app.getHttpServer()).get('/v1/dev/outbox').query({ email });
  const item = (res.body.items as Array<{ type: string; data: { token?: string } }>).find((i) => i.type === type);
  if (!item?.data.token) throw new Error(`No ${type} email for ${email}`);
  return item.data.token;
}

export async function registerAndVerify(app: INestApplication, email: string, password: string): Promise<Client> {
  const c = new Client(app);
  await c.post('/v1/auth/register', { email, password, acceptTerms: true, acceptPrivacy: true });
  const token = await latestEmailToken(app, email, 'auth.verify_email');
  await c.post('/v1/auth/verify-email', { token });
  const login = await c.post('/v1/auth/login', { email, password });
  if (login.status !== 200) throw new Error(`login failed ${login.status} ${JSON.stringify(login.body)}`);
  return c;
}

export async function verifiedInvestor(app: INestApplication, tag: string, country = 'ES'): Promise<{ client: Client; email: string }> {
  const email = uniqueEmail(tag);
  const client = await registerAndVerify(app, email, 'a long enough passphrase');
  await client.post('/v1/kyc/start', { countryOfResidence: country, nationality: country });
  const r = await client.post('/v1/dev/kyc/complete', { outcome: 'clear' });
  if (r.body.status !== 'APPROVED') throw new Error(`KYC not approved: ${JSON.stringify(r.body)}`);
  return { client, email };
}

export async function placeOrder(client: Client, slug: string, amount: string, key = `k-${Date.now()}-${Math.random().toString(36).slice(2)}`): Promise<request.Response> {
  return client.post('/v1/subscriptions', { propertySlug: slug, amount }, { 'Idempotency-Key': key });
}

export async function acceptAll(client: Client, order: { id: string; requiredDocuments: Array<{ id: string }> }): Promise<request.Response> {
  return client.post(`/v1/subscriptions/${order.id}/accept-documents`, { documentIds: order.requiredDocuments.map((d) => d.id) });
}

/**
 * A verified account with MFA enabled and the given staff roles — what the
 * back office requires. Roles are granted directly in the database, as the
 * staff:create script does.
 */
export async function staffMember(
  app: INestApplication,
  prisma: PrismaService,
  tag: string,
  roles: Array<'PROPERTY_MANAGER' | 'COMPLIANCE_OFFICER' | 'ADMINISTRATOR' | 'SUPER_ADMINISTRATOR'>,
  opts: { mfa?: boolean } = {},
): Promise<{ client: Client; email: string; userId: string }> {
  const email = uniqueEmail(tag);
  const client = await registerAndVerify(app, email, 'a long enough passphrase');
  if (opts.mfa !== false) {
    const setup = await client.post('/v1/auth/mfa/setup');
    const enabled = await client.post('/v1/auth/mfa/enable', { code: totpAt(setup.body.secret as string, Date.now()) });
    if (enabled.status !== 204) throw new Error(`MFA enable failed ${enabled.status} ${JSON.stringify(enabled.body)}`);
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  for (const role of roles) await prisma.userRole.create({ data: { userId: user.id, roleId: stableId('role', role) } });
  return { client, email, userId: user.id };
}

/** Order → documents → simulated payment → allocation. Returns the order id. */
export async function invest(client: Client, slug: string, amount: string): Promise<string> {
  const created = await placeOrder(client, slug, amount);
  if (created.status !== 201) throw new Error(`order failed ${created.status} ${JSON.stringify(created.body)}`);
  await acceptAll(client, created.body);
  const paid = await client.post(`/v1/dev/payments/${created.body.id}/simulate`, { outcome: 'succeeded' });
  if (paid.body.status !== 'allocated') throw new Error(`payment not allocated: ${JSON.stringify(paid.body)}`);
  return created.body.id as string;
}
