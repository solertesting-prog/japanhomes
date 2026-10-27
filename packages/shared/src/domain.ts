/**
 * Domain vocabulary shared by api, web and database seed.
 * Enum values mirror the Prisma enums one-to-one.
 */

export const CITIES = ['tokyo', 'osaka', 'kyoto', 'fukuoka', 'sapporo', 'nagoya', 'yokohama', 'kobe'] as const;
export type City = (typeof CITIES)[number];

export const PREFECTURES = ['tokyo', 'osaka', 'kyoto', 'fukuoka', 'hokkaido', 'aichi', 'kanagawa', 'hyogo'] as const;
export type Prefecture = (typeof PREFECTURES)[number];

export const CITY_PREFECTURE: Record<City, Prefecture> = {
  tokyo: 'tokyo',
  osaka: 'osaka',
  kyoto: 'kyoto',
  fukuoka: 'fukuoka',
  sapporo: 'hokkaido',
  nagoya: 'aichi',
  yokohama: 'kanagawa',
  kobe: 'hyogo',
};

export const PROPERTY_TYPES = [
  'APARTMENT',
  'HOUSE',
  'RESIDENTIAL_BUILDING',
  'COMMERCIAL',
  'VACATION_HOME',
  'AKIYA',
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

/** Lifecycle of the primary offering (subscription round). */
export const FUNDING_STATUSES = ['COMING_SOON', 'OPEN', 'FUNDED', 'CLOSED'] as const;
export type FundingStatus = (typeof FUNDING_STATUSES)[number];

export const RENTAL_STATUSES = ['LEASED', 'PARTIALLY_LEASED', 'VACANT', 'UNDER_RENOVATION', 'SHORT_TERM_RENTAL'] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];

export const PROPERTY_CONDITIONS = ['NEW', 'EXCELLENT', 'GOOD', 'NEEDS_RENOVATION'] as const;
export type PropertyCondition = (typeof PROPERTY_CONDITIONS)[number];

/**
 * Who may see a document.
 *  PUBLIC          anyone, including visitors
 *  REGISTERED      signed-in users
 *  VERIFIED        KYC-approved investors
 *  INVESTOR_ONLY   holders of this specific offering
 *  INTERNAL        staff only (compliance, admin)
 */
export const DOCUMENT_ACCESS_LEVELS = ['PUBLIC', 'REGISTERED', 'VERIFIED', 'INVESTOR_ONLY', 'INTERNAL'] as const;
export type DocumentAccessLevel = (typeof DOCUMENT_ACCESS_LEVELS)[number];

export const DOCUMENT_TYPES = [
  'LEGAL_STRUCTURE',
  'RISK_DISCLOSURE',
  'VALUATION_REPORT',
  'INSPECTION_REPORT',
  'FINANCIAL_STATEMENT',
  'INVESTMENT_CONTRACT',
  'ISSUANCE_DOCUMENT',
  'ENGINEERING_REPORT',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Legal wrapper chosen for an offering. See docs/LEGAL_MODEL.md.
 * None of these is "approved": the platform records which structure an
 * offering intends to use and blocks regulated flows until counsel signs off.
 */
export const LEGAL_STRUCTURES = [
  'TRUST_BENEFICIARY_INTEREST',
  'GK_TK_SILENT_PARTNERSHIP',
  'TOKUTEI_KYODO_JIGYO',
  'TMK_PREFERRED_EQUITY',
] as const;
export type LegalStructure = (typeof LEGAL_STRUCTURES)[number];

export const ROLES = [
  'VISITOR',
  'INVESTOR',
  'VERIFIED_INVESTOR',
  'PROPERTY_MANAGER',
  'COMPLIANCE_OFFICER',
  'ADMINISTRATOR',
  'SUPER_ADMINISTRATOR',
] as const;
export type Role = (typeof ROLES)[number];

export const KYC_STATUSES = ['NOT_STARTED', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const SUPPORTED_LOCALES = ['en', 'ja', 'es'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const DISPLAY_CURRENCIES = ['JPY', 'USD', 'EUR'] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];
