/**
 * Pure builder for seed rows. No Prisma import here so the rows can be
 * validated independently (unit tests, SQL fixtures) and reused by seed.ts.
 *
 * Every row produced is DEMO data (isDemo = true where the column exists).
 */
import { createHash } from 'node:crypto';
import { computeOfferingMetrics, DEMO_PROPERTIES, type PropertyRecord } from '@jpt/shared';

type RoleKey =
  | 'VISITOR'
  | 'INVESTOR'
  | 'VERIFIED_INVESTOR'
  | 'PROPERTY_MANAGER'
  | 'COMPLIANCE_OFFICER'
  | 'ADMINISTRATOR'
  | 'SUPER_ADMINISTRATOR';

export const PERMISSIONS = {
  'property:read': 'Read published properties',
  'property:write': 'Create and edit properties',
  'property:publish': 'Publish and unpublish properties',
  'document:read:verified': 'Download documents restricted to verified investors',
  'document:write': 'Upload property and offering documents',
  'offering:write': 'Create and configure token offerings',
  'offering:approve': 'Move an offering out of legal review',
  'investment:create': 'Subscribe to an offering',
  'kyc:review': 'Review and decide KYC cases',
  'user:read': 'Search users',
  'user:block': 'Block and unblock accounts',
  'role:assign': 'Grant and revoke roles',
  'finance:record': 'Record rental income and expenses',
  'distribution:prepare': 'Prepare distributions',
  'distribution:approve': 'Approve distributions (four-eyes)',
  'payment:approve': 'Approve outbound payments',
  'audit:read': 'Read the audit log',
  'analytics:read': 'Read platform analytics',
  'token:operate': 'Deploy contracts on the simulated chain or a testnet and run token operations',
} as const;
export type PermissionKey = keyof typeof PERMISSIONS;

export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  VISITOR: ['property:read'],
  INVESTOR: ['property:read'],
  VERIFIED_INVESTOR: ['property:read', 'document:read:verified', 'investment:create'],
  PROPERTY_MANAGER: ['property:read', 'property:write', 'document:write', 'finance:record'],
  COMPLIANCE_OFFICER: ['property:read', 'kyc:review', 'user:read', 'user:block', 'audit:read', 'offering:approve'],
  ADMINISTRATOR: [
    'property:read', 'property:write', 'property:publish', 'document:write', 'offering:write', 'user:read',
    'finance:record', 'distribution:prepare', 'analytics:read', 'audit:read', 'token:operate',
  ],
  SUPER_ADMINISTRATOR: Object.keys(PERMISSIONS) as PermissionKey[],
};

const ROLE_NAMES: Record<RoleKey, string> = {
  VISITOR: 'Visitor',
  INVESTOR: 'Investor',
  VERIFIED_INVESTOR: 'Verified investor',
  PROPERTY_MANAGER: 'Property manager',
  COMPLIANCE_OFFICER: 'Compliance officer',
  ADMINISTRATOR: 'Administrator',
  SUPER_ADMINISTRATOR: 'Super administrator',
};

/** Deterministic UUID (v4 layout) from a name, so re-seeding is idempotent. */
export function stableId(namespace: string, name: string): string {
  const h = createHash('sha256').update(`${namespace}:${name}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const upper = <T extends string>(s: T) => s.toUpperCase() as Uppercase<T>;

export const DEMO_OPERATOR_USER_ID = stableId('user', 'demo-operations');

export function buildSeedRows(now = new Date('2026-10-27T00:00:00Z')) {
  const roles = (Object.keys(ROLE_NAMES) as RoleKey[]).map((key) => ({
    id: stableId('role', key),
    key,
    name: ROLE_NAMES[key],
    description: null as string | null,
  }));
  const permissions = (Object.keys(PERMISSIONS) as PermissionKey[]).map((key) => ({
    id: stableId('permission', key),
    key,
    description: PERMISSIONS[key],
  }));
  const rolePermissions = (Object.keys(ROLE_PERMISSIONS) as RoleKey[]).flatMap((role) =>
    ROLE_PERMISSIONS[role].map((perm) => ({ roleId: stableId('role', role), permissionId: stableId('permission', perm) })),
  );

  // A non-login operations account used as the approver of DEMO distributions.
  const users = [
    {
      id: DEMO_OPERATOR_USER_ID,
      email: 'demo-operations@example.invalid',
      // "!" is not a valid Argon2 hash: this account can never sign in.
      passwordHash: '!',
      status: 'LOCKED' as const,
      updatedAt: now,
    },
  ];

  const legalEntities = [
    {
      id: stableId('entity', 'demo-spv'),
      name: 'JPT Demo Holdings GK (fictional)',
      nameJa: 'JPTデモホールディングス合同会社（架空）',
      type: 'GODO_KAISHA' as const,
      role: 'ISSUER_SPV' as const,
      corporateNumber: null as string | null,
      registeredAddress: null as string | null,
      licenses: [] as unknown[],
      isDemo: true,
      updatedAt: now,
    },
    {
      id: stableId('entity', 'demo-trustee'),
      name: 'Fictional Trust Bank (DEMO)',
      nameJa: '架空信託銀行（デモ）',
      type: 'TRUST_BANK' as const,
      role: 'TRUSTEE' as const,
      corporateNumber: null as string | null,
      registeredAddress: null as string | null,
      licenses: [] as unknown[],
      isDemo: true,
      updatedAt: now,
    },
  ];

  const issuerId = legalEntities[0]!.id;
  const trusteeId = legalEntities[1]!.id;

  const properties = [] as Array<Record<string, unknown>>;
  const financials = [] as Array<Record<string, unknown>>;
  const valuations = [] as Array<Record<string, unknown>>;
  const risks = [] as Array<Record<string, unknown>>;
  const ownerships = [] as Array<Record<string, unknown>>;
  const offerings = [] as Array<Record<string, unknown>>;
  const contracts = [] as Array<Record<string, unknown>>;
  const documents = [] as Array<Record<string, unknown>>;
  const distributions = [] as Array<Record<string, unknown>>;

  for (const p of DEMO_PROPERTIES) {
    properties.push(propertyRow(p, now));
    const financialId = stableId('financial', p.slug);
    const f = p.financials;
    financials.push({
      id: financialId,
      propertyId: p.id,
      version: 1,
      isCurrent: true,
      purchasePrice: f.purchasePrice,
      acquisitionCosts: f.acquisitionCosts,
      renovationCosts: f.renovationCosts,
      reserves: f.reserves,
      annualGrossRent: f.annualGrossRent,
      occupancyBps: f.occupancyBps,
      annualOperatingExpenses: f.annualOperatingExpenses,
      annualPropertyTax: f.annualPropertyTax,
      propertyManagementFeeBps: f.propertyManagementFeeBps,
      platformFeeBps: f.platformFeeBps,
      subscriptionFeeBps: f.subscriptionFeeBps,
      notes: 'DEMO underwriting assumptions',
    });
    valuations.push({
      id: stableId('valuation', p.slug),
      propertyId: p.id,
      appraisedValue: p.valuation.appraisedValue,
      method: p.valuation.method,
      appraiser: p.valuation.appraiser,
      appraisedAt: p.valuation.appraisedAt,
    });
    p.risks.forEach((r, i) =>
      risks.push({ id: stableId('risk', `${p.slug}:${i}`), propertyId: p.id, title: r.title, detail: r.detail, level: r.level, sortOrder: i }),
    );

    // Title is held by the trustee (trust structures) or the SPV (TK / 不特法).
    const titleHolder = p.legalStructure === 'TRUST_BENEFICIARY_INTEREST' ? trusteeId : issuerId;
    ownerships.push({
      id: stableId('ownership', `${p.slug}:title`),
      propertyId: p.id,
      legalEntityId: titleHolder,
      ownershipType: p.legalStructure === 'TRUST_BENEFICIARY_INTEREST' ? 'TRUSTEE_TITLE' : 'LEGAL_TITLE',
      shareBps: 10_000,
      registryReference: null,
      validFrom: p.publishedAt,
    });
    if (p.legalStructure === 'TRUST_BENEFICIARY_INTEREST') {
      ownerships.push({
        id: stableId('ownership', `${p.slug}:beneficiary`),
        propertyId: p.id,
        legalEntityId: issuerId,
        ownershipType: 'TRUST_BENEFICIARY',
        shareBps: 10_000,
        registryReference: null,
        validFrom: p.publishedAt,
      });
    }

    const offeringId = stableId('offering', p.slug);
    const m = computeOfferingMetrics(f);
    offerings.push({
      id: offeringId,
      propertyId: p.id,
      issuerEntityId: issuerId,
      financialId,
      isDemo: true,
      legalStructure: p.legalStructure,
      status: p.fundingStatus,
      tokenName: p.token.name,
      tokenSymbol: p.token.symbol,
      totalTokens: f.totalTokens,
      tokenPrice: m.tokenPrice,
      tokensSold: p.tokensSold,
      tokensReserved: 0n,
      minimumInvestment: p.minimumInvestment,
      maximumInvestment: p.maximumInvestment,
      opensAt: p.roundOpensAt,
      closesAt: p.roundClosesAt,
      lockupUntil: null,
      economicRights: p.token.economicRights,
      transferRestrictions: p.token.transferRestrictions,
      votingRights: 'Investors vote on sale of the property and change of asset manager (DEMO terms).',
      legalApprovalRef: null,
      updatedAt: now,
    });
    contracts.push({
      id: stableId('contract', p.slug),
      offeringId,
      chainId: 0,
      network: p.token.network,
      standard: 'ERC3643',
      status: 'PLANNED',
      updatedAt: now,
    });
    for (const d of p.documents) {
      documents.push({
        id: d.id,
        propertyId: p.id,
        offeringId,
        type: d.type,
        title: d.title,
        accessLevel: d.accessLevel,
        storageKey: `demo/${p.slug}/${d.type.toLowerCase()}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: d.sizeKb * 1024,
        sha256: sha256(`${p.slug}:${d.type}:v1`),
        version: 1,
        publishedAt: p.publishedAt,
      });
    }
    // Quarterly DEMO distributions, broken down so the formula CHECK holds exactly.
    for (const d of p.distributions) {
      const gross = m.effectiveGrossIncome / 4n;
      const taxes = f.annualPropertyTax / 4n;
      const fees = (m.propertyManagementFee + m.platformFee) / 4n;
      const operatingExpenses = gross - taxes - fees - d.totalAmount;
      if (operatingExpenses < 0n) throw new Error(`Seed: negative opex for ${p.slug}`);
      distributions.push({
        id: d.id,
        offeringId,
        isDemo: true,
        periodStart: d.periodStart,
        periodEnd: d.periodEnd,
        status: 'PAID',
        grossIncome: gross,
        operatingExpenses,
        taxes,
        reserveAllocation: 0n,
        fees,
        distributableAmount: d.totalAmount,
        recordDate: d.periodEnd,
        paymentDate: d.paidAt,
        approvedById: DEMO_OPERATOR_USER_ID,
        approvedAt: d.paidAt,
        paidAt: d.paidAt,
        updatedAt: now,
      });
    }
  }

  return {
    roles,
    permissions,
    rolePermissions,
    users,
    legalEntities,
    properties,
    financials,
    valuations,
    risks,
    ownerships,
    offerings,
    contracts,
    documents,
    distributions,
  };
}

function propertyRow(p: PropertyRecord, now: Date) {
  return {
    id: p.id,
    slug: p.slug,
    isDemo: true,
    status: 'PUBLISHED',
    name: p.name,
    city: upper(p.city),
    prefecture: upper(p.prefecture),
    neighborhood: p.neighborhood,
    approximateAddress: p.approximateAddress,
    latitude: p.latitude.toFixed(5),
    longitude: p.longitude.toFixed(5),
    type: p.type,
    layout: p.layout,
    structure: p.structure,
    floorAreaM2: p.floorAreaM2.toFixed(2),
    landAreaM2: p.landAreaM2 === null ? null : p.landAreaM2.toFixed(2),
    yearBuilt: p.yearBuilt,
    nearestStation: p.nearestStation,
    walkMinutes: p.walkMinutes,
    condition: p.condition,
    rentalStatus: p.rentalStatus,
    summary: p.summary,
    description: p.description,
    highlights: p.highlights,
    featured: p.featured,
    publishedAt: p.publishedAt,
    updatedAt: now,
  };
}

export type SeedRows = ReturnType<typeof buildSeedRows>;
