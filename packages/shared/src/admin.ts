/**
 * Wire types for the back-office API. Money is integer yen as a decimal string.
 */

export const STAFF_ROLES = ['PROPERTY_MANAGER', 'COMPLIANCE_OFFICER', 'ADMINISTRATOR', 'SUPER_ADMINISTRATOR'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Permissions an investor account can hold; anything else is back-office. */
export const INVESTOR_PERMISSION_KEYS = ['property:read', 'document:read:verified', 'investment:create'] as const;

export function isStaff(permissions: readonly string[]): boolean {
  return permissions.some((p) => !(INVESTOR_PERMISSION_KEYS as readonly string[]).includes(p));
}

export const OFFERING_STATUSES = ['DRAFT', 'LEGAL_REVIEW', 'APPROVED', 'COMING_SOON', 'OPEN', 'FUNDED', 'CLOSED', 'CANCELLED'] as const;
export type OfferingStatusKey = (typeof OFFERING_STATUSES)[number];

/** Allowed offering lifecycle moves and the permission each one needs. */
export const OFFERING_TRANSITIONS: Record<OfferingStatusKey, Partial<Record<OfferingStatusKey, string>>> = {
  DRAFT: { LEGAL_REVIEW: 'offering:write', CANCELLED: 'offering:write' },
  LEGAL_REVIEW: { APPROVED: 'offering:approve', DRAFT: 'offering:write', CANCELLED: 'offering:write' },
  APPROVED: { COMING_SOON: 'offering:write', OPEN: 'offering:write', CANCELLED: 'offering:write' },
  COMING_SOON: { OPEN: 'offering:write', CANCELLED: 'offering:write' },
  OPEN: { FUNDED: 'offering:write', CLOSED: 'offering:write', CANCELLED: 'offering:write' },
  FUNDED: { CLOSED: 'offering:write' },
  CLOSED: {},
  CANCELLED: {},
};

export const EXPENSE_CATEGORIES = [
  'BUILDING_MANAGEMENT',
  'REPAIR_RESERVE',
  'REPAIRS',
  'INSURANCE',
  'PROPERTY_TAX',
  'UTILITIES',
  'PROPERTY_MANAGEMENT_FEE',
  'PLATFORM_FEE',
  'LEGAL_AND_ACCOUNTING',
  'OTHER',
] as const;
export type ExpenseCategoryKey = (typeof EXPENSE_CATEGORIES)[number];

/**
 * How recorded expenses map onto the distribution formula
 *   distributable = gross − operatingExpenses − taxes − reserve − fees
 */
export function expenseBucket(category: ExpenseCategoryKey): 'taxes' | 'fees' | 'operatingExpenses' {
  if (category === 'PROPERTY_TAX') return 'taxes';
  if (category === 'PROPERTY_MANAGEMENT_FEE' || category === 'PLATFORM_FEE') return 'fees';
  return 'operatingExpenses';
}

/**
 * Default withholding on distributions to Japan-resident individuals:
 * 20.42 % (income tax 20 % + special reconstruction income tax 2.1 % of it).
 * [VALIDAR con asesor fiscal] — rate depends on the legal structure (TK vs
 * beneficiary certificate), investor type and treaty position.
 */
export const DEFAULT_WITHHOLDING_BPS = 2042;

export interface AdminOverviewDto {
  users: { total: number; staff: number; verifiedInvestors: number };
  kyc: { pending: number; underReview: number };
  orders: { awaitingPayment: number; allocated: number; refunded: number };
  raised: string;
  distributions: { awaitingApproval: number; awaitingPayment: number };
  audit: { entries: number };
}

export interface AdminOfferingDto {
  id: string;
  tokenSymbol: string;
  status: OfferingStatusKey;
  isDemo: boolean;
  totalTokens: string;
  tokensSold: string;
  tokensReserved: string;
  tokenPrice: string;
  legalApprovalRef: string | null;
  investors: number;
}

export interface AdminPropertyDto {
  id: string;
  slug: string;
  name: string;
  city: string;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
  featured: boolean;
  isDemo: boolean;
  offerings: AdminOfferingDto[];
}

export interface FinanceRecordsDto {
  property: { id: string; name: string };
  income: Array<{ id: string; periodMonth: string; amount: string; notes: string | null; createdAt: string }>;
  expenses: Array<{ id: string; category: ExpenseCategoryKey; amount: string; incurredAt: string; description: string; createdAt: string }>;
}

export type DistributionStatusKey = 'DRAFT' | 'CALCULATED' | 'APPROVED' | 'PAYING' | 'PAID' | 'CANCELLED';

export interface DistributionSummaryDto {
  id: string;
  offeringId: string;
  tokenSymbol: string;
  propertyName: string;
  isDemo: boolean;
  status: DistributionStatusKey;
  periodStart: string;
  periodEnd: string;
  grossIncome: string;
  operatingExpenses: string;
  taxes: string;
  reserveAllocation: string;
  fees: string;
  distributableAmount: string;
  allocatedAmount: string;
  recordDate: string | null;
  preparedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  holders: number;
}

export interface DistributionDetailDto extends DistributionSummaryDto {
  /** Share of holdings not linked to platform accounts (DEMO supply); not paid by this run. */
  unallocatedAmount: string;
  allocations: Array<{
    id: string;
    email: string;
    tokensAtRecord: string;
    grossAmount: string;
    withholdingTaxBps: number;
    withholdingTax: string;
    netAmount: string;
    status: 'PENDING' | 'HELD' | 'PAID' | 'FAILED';
    holdReason: string | null;
    paidAt: string | null;
  }>;
}

export interface AuditEntryDto {
  id: string;
  occurredAt: string;
  actorType: 'USER' | 'SYSTEM' | 'WEBHOOK';
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  hash: string;
}

export interface AuditVerifyDto {
  checked: number;
  ok: boolean;
  /** First row whose link or content hash does not verify. */
  firstBrokenId: string | null;
  reason: string | null;
}
