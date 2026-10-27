/**
 * Creates (or re-roles) a staff account and prints a one-time random password.
 *
 *   pnpm --filter @jpt/database staff:create -- --email ops@example.com --role COMPLIANCE_OFFICER
 *
 * Staff accounts are never created by the seed, so no known credentials ship
 * with the code. The password is shown once; the user must change it and
 * enable MFA on first sign-in.
 */
import { randomBytes } from 'node:crypto';
import { PrismaClient, RoleKey } from '@prisma/client';
import { hashPassword } from './password';
import { stableId } from './seed-data';

const STAFF_ROLES: RoleKey[] = ['PROPERTY_MANAGER', 'COMPLIANCE_OFFICER', 'ADMINISTRATOR', 'SUPER_ADMINISTRATOR'];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg('email')?.trim().toLowerCase();
  const role = arg('role') as RoleKey | undefined;
  if (!email || !role || !STAFF_ROLES.includes(role)) {
    throw new Error(`Usage: --email <email> --role <${STAFF_ROLES.join('|')}>`);
  }
  const prisma = new PrismaClient();
  try {
    const password = randomBytes(18).toString('base64url');
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash: await hashPassword(password), emailVerifiedAt: new Date() },
      update: {},
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: stableId('role', role) } },
      create: { userId: user.id, roleId: stableId('role', role) },
      update: {},
    });
    console.log(`Staff account ready: ${email} (${role})`);
    if (user.createdAt.getTime() > Date.now() - 10_000) {
      console.log(`One-time password: ${password}`);
      console.log('Store it in a password manager now; it is not shown again.');
    } else {
      console.log('Existing account: password unchanged.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
