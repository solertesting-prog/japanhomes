/**
 * Seeds roles, permissions and the DEMO catalogue. Idempotent: every row has a
 * deterministic id and is upserted, so `pnpm db:seed` can run repeatedly.
 *
 * Refuses to run against a production database.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { buildSeedRows } from './seed-data';

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.JPT_ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Refusing to seed DEMO data with NODE_ENV=production (set JPT_ALLOW_DEMO_SEED=true for a staging demo).');
  }

  const prisma = new PrismaClient();
  const rows = buildSeedRows();

  // Each model is upserted by primary key; `update` re-applies the fixture so
  // edits to DEMO data propagate on re-seed — except operational state that
  // the running platform owns (sales, lifecycle status, visibility, deployed
  // contracts), which a re-seed must never roll back.
  const omit = <T extends object, K extends keyof T>(row: T, keys: K[]): Omit<T, K> => {
    const copy = { ...row };
    for (const k of keys) delete copy[k];
    return copy;
  };
  const upsertAll = async <T extends { id: string }>(
    label: string,
    items: T[],
    fn: (item: T) => Promise<unknown>,
  ) => {
    for (const item of items) await fn(item);
    console.log(`  ${label.padEnd(22)} ${items.length}`);
  };

  try {
    console.log('Seeding Japan Property Token (DEMO data)…');
    await prisma.$transaction(
      async (tx) => {
        await upsertAll('roles', rows.roles, (r) => tx.role.upsert({ where: { id: r.id }, create: r, update: r }));
        await upsertAll('permissions', rows.permissions, (p) =>
          tx.permission.upsert({ where: { id: p.id }, create: p, update: p }),
        );
        for (const rp of rows.rolePermissions) {
          await tx.rolePermission.upsert({
            where: { roleId_permissionId: rp },
            create: rp,
            update: {},
          });
        }
        console.log(`  ${'role permissions'.padEnd(22)} ${rows.rolePermissions.length}`);
        await upsertAll('users', rows.users, (u) => tx.user.upsert({ where: { id: u.id }, create: u, update: u }));
        await upsertAll('legal entities', rows.legalEntities, (e) => {
          const data = { ...e, licenses: e.licenses as Prisma.InputJsonValue };
          return tx.legalEntity.upsert({ where: { id: e.id }, create: data, update: data });
        });
        await upsertAll('properties', rows.properties as Array<Prisma.PropertyUncheckedCreateInput & { id: string }>, (p) =>
          tx.property.upsert({ where: { id: p.id }, create: p, update: omit(p, ['status', 'featured', 'publishedAt']) }),
        );
        await upsertAll('financials', rows.financials as Array<Prisma.PropertyFinancialUncheckedCreateInput & { id: string }>, (f) =>
          tx.propertyFinancial.upsert({ where: { id: f.id }, create: f, update: f }),
        );
        await upsertAll('valuations', rows.valuations as Array<Prisma.PropertyValuationUncheckedCreateInput & { id: string }>, (v) =>
          tx.propertyValuation.upsert({ where: { id: v.id }, create: v, update: v }),
        );
        await upsertAll('risks', rows.risks as Array<Prisma.PropertyRiskUncheckedCreateInput & { id: string }>, (r) =>
          tx.propertyRisk.upsert({ where: { id: r.id }, create: r, update: r }),
        );
        await upsertAll('ownerships', rows.ownerships as Array<Prisma.PropertyOwnershipUncheckedCreateInput & { id: string }>, (o) =>
          tx.propertyOwnership.upsert({ where: { id: o.id }, create: o, update: o }),
        );
        await upsertAll('offerings', rows.offerings as Array<Prisma.TokenOfferingUncheckedCreateInput & { id: string }>, (o) =>
          tx.tokenOffering.upsert({
            where: { id: o.id },
            create: o,
            update: omit(o, ['status', 'tokensSold', 'tokensReserved', 'legalApprovalRef', 'approvedById', 'approvedAt']),
          }),
        );
        await upsertAll('token contracts', rows.contracts as Array<Prisma.TokenContractUncheckedCreateInput & { id: string }>, (c) =>
          tx.tokenContract.upsert({ where: { id: c.id }, create: c, update: {} }),
        );
        await upsertAll('documents', rows.documents as Array<Prisma.PropertyDocumentUncheckedCreateInput & { id: string }>, (d) =>
          tx.propertyDocument.upsert({ where: { id: d.id }, create: d, update: d }),
        );
        await upsertAll('distributions', rows.distributions as Array<Prisma.DistributionUncheckedCreateInput & { id: string }>, (d) =>
          tx.distribution.upsert({ where: { id: d.id }, create: d, update: d }),
        );
      },
      { timeout: 60_000 },
    );
    console.log('Done. All seeded properties are flagged isDemo = true.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
