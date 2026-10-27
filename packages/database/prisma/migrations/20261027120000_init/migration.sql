-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'LOCKED', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RoleKey" AS ENUM ('VISITOR', 'INVESTOR', 'VERIFIED_INVESTOR', 'PROPERTY_MANAGER', 'COMPLIANCE_OFFICER', 'ADMINISTRATOR', 'SUPER_ADMINISTRATOR');

-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'MFA_RECOVERY');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "KycCheckType" AS ENUM ('DOCUMENT', 'LIVENESS', 'IDENTITY_MATCH', 'ADDRESS', 'AML_SCREENING', 'SANCTIONS', 'PEP', 'ADVERSE_MEDIA', 'JURISDICTION');

-- CreateEnum
CREATE TYPE "KycCheckResult" AS ENUM ('CLEAR', 'CONSIDER', 'FAIL', 'ERROR');

-- CreateEnum
CREATE TYPE "InvestorCategory" AS ENUM ('RETAIL', 'QUALIFIED_INSTITUTIONAL_INVESTOR', 'SPECIFIED_INVESTOR', 'PROFESSIONAL_FOREIGN');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'RISK_DISCLOSURE', 'ELECTRONIC_DELIVERY', 'CROSS_BORDER_DATA_TRANSFER', 'MARKETING');

-- CreateEnum
CREATE TYPE "LegalEntityType" AS ENUM ('GODO_KAISHA', 'KABUSHIKI_KAISHA', 'TOKUTEI_MOKUTEKI_KAISHA', 'TRUST_BANK', 'IPPAN_SHADAN_HOJIN', 'FOREIGN_ENTITY');

-- CreateEnum
CREATE TYPE "LegalEntityRole" AS ENUM ('ISSUER_SPV', 'TRUSTEE', 'ASSET_MANAGER', 'TOKUTEI_KYODO_OPERATOR', 'PROPERTY_MANAGER', 'FINANCIAL_INSTRUMENTS_INTERMEDIARY', 'CUSTODIAN', 'PLATFORM_OPERATOR');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "City" AS ENUM ('TOKYO', 'OSAKA', 'KYOTO', 'FUKUOKA', 'SAPPORO', 'NAGOYA', 'YOKOHAMA', 'KOBE');

-- CreateEnum
CREATE TYPE "Prefecture" AS ENUM ('TOKYO', 'OSAKA', 'KYOTO', 'FUKUOKA', 'HOKKAIDO', 'AICHI', 'KANAGAWA', 'HYOGO');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'HOUSE', 'RESIDENTIAL_BUILDING', 'COMMERCIAL', 'VACATION_HOME', 'AKIYA');

-- CreateEnum
CREATE TYPE "PropertyCondition" AS ENUM ('NEW', 'EXCELLENT', 'GOOD', 'NEEDS_RENOVATION');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('LEASED', 'PARTIALLY_LEASED', 'VACANT', 'UNDER_RENOVATION', 'SHORT_TERM_RENTAL');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('LEGAL_STRUCTURE', 'RISK_DISCLOSURE', 'VALUATION_REPORT', 'INSPECTION_REPORT', 'FINANCIAL_STATEMENT', 'INVESTMENT_CONTRACT', 'ISSUANCE_DOCUMENT', 'ENGINEERING_REPORT', 'SMART_CONTRACT_AUDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentAccessLevel" AS ENUM ('PUBLIC', 'REGISTERED', 'VERIFIED', 'INVESTOR_ONLY', 'INTERNAL');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('LEGAL_TITLE', 'TRUSTEE_TITLE', 'TRUST_BENEFICIARY', 'LEASEHOLD');

-- CreateEnum
CREATE TYPE "LegalStructure" AS ENUM ('TRUST_BENEFICIARY_INTEREST', 'GK_TK_SILENT_PARTNERSHIP', 'TOKUTEI_KYODO_JIGYO', 'TMK_PREFERRED_EQUITY');

-- CreateEnum
CREATE TYPE "OfferingStatus" AS ENUM ('DRAFT', 'LEGAL_REVIEW', 'APPROVED', 'COMING_SOON', 'OPEN', 'FUNDED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TokenStandard" AS ENUM ('ERC3643', 'ERC1400', 'ERC20_PERMISSIONED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('PLANNED', 'DEPLOYED', 'PAUSED', 'RETIRED');

-- CreateEnum
CREATE TYPE "WalletType" AS ENUM ('CUSTODIAL', 'SELF_CUSTODY');

-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'FROZEN', 'REVOKED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('DRAFT', 'PENDING_DOCUMENTS', 'AWAITING_PAYMENT', 'PAYMENT_RECEIVED', 'COMPLIANCE_CHECK', 'ALLOCATING', 'ALLOCATED', 'CANCELLED', 'EXPIRED', 'REJECTED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('SUBSCRIPTION', 'REFUND', 'DISTRIBUTION', 'FEE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentEventType" AS ENUM ('INTENT_CREATED', 'WEBHOOK_RECEIVED', 'CAPTURED', 'FAILED', 'REFUND_ISSUED', 'RECONCILED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('PENDING', 'MINT_SUBMITTED', 'MINTED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "DistributionStatus" AS ENUM ('DRAFT', 'CALCULATED', 'APPROVED', 'PAYING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DistributionAllocationStatus" AS ENUM ('PENDING', 'HELD', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('BUILDING_MANAGEMENT', 'REPAIR_RESERVE', 'REPAIRS', 'INSURANCE', 'PROPERTY_TAX', 'UTILITIES', 'PROPERTY_MANAGEMENT_FEE', 'PLATFORM_FEE', 'LEGAL_AND_ACCOUNTING', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "SecondaryOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'OPEN', 'MATCHED', 'SETTLED', 'CANCELLED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('SUBSCRIPTION', 'PAYMENT', 'ISSUANCE', 'DISTRIBUTION', 'REFUND', 'AUTHORIZED_TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "passwordHash" VARCHAR(255) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretEnc" BYTEA,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "lastLoginAt" TIMESTAMPTZ(3),
    "locale" VARCHAR(5) NOT NULL DEFAULT 'en',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Tokyo',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "legalNameEnc" BYTEA,
    "dateOfBirthEnc" BYTEA,
    "addressEnc" BYTEA,
    "phoneEnc" BYTEA,
    "nationality" CHAR(2),
    "countryOfResidence" CHAR(2),
    "isEntity" BOOLEAN NOT NULL DEFAULT false,
    "piiKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "key" "RoleKey" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId", "permissionId")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "grantedById" UUID,
    "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId", "roleId")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "userAgent" VARCHAR(512),
    "ipHash" CHAR(64),
    "mfaVerifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_verifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "providerReference" VARCHAR(120),
    "status" "KycStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "level" VARCHAR(40) NOT NULL DEFAULT 'standard',
    "riskScore" INTEGER,
    "pepMatch" BOOLEAN NOT NULL DEFAULT false,
    "sanctionsMatch" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMPTZ(3),
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewedById" UUID,
    "decisionReason" TEXT,
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "kyc_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_checks" (
    "id" UUID NOT NULL,
    "verificationId" UUID NOT NULL,
    "type" "KycCheckType" NOT NULL,
    "result" "KycCheckResult" NOT NULL,
    "evidenceKey" VARCHAR(512),
    "summary" TEXT,
    "checkedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beneficial_owners" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "nameEnc" BYTEA NOT NULL,
    "ownershipBps" INTEGER NOT NULL,
    "countryOfResidence" CHAR(2) NOT NULL,
    "isControllingPerson" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beneficial_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_eligibilities" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "jurisdiction" CHAR(2) NOT NULL,
    "category" "InvestorCategory" NOT NULL DEFAULT 'RETAIL',
    "isEligible" BOOLEAN NOT NULL,
    "ruleResults" JSONB NOT NULL,
    "ruleSetVersion" VARCHAR(40) NOT NULL,
    "maxInvestmentPerOffering" BIGINT,
    "assessedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessedById" UUID,
    "validUntil" TIMESTAMPTZ(3),

    CONSTRAINT "investor_eligibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" VARCHAR(40) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" CHAR(64),
    "userAgent" VARCHAR(512),
    "withdrawnAt" TIMESTAMPTZ(3),

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_entities" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "nameJa" VARCHAR(200),
    "type" "LegalEntityType" NOT NULL,
    "role" "LegalEntityRole" NOT NULL,
    "corporateNumber" CHAR(13),
    "registeredAddress" TEXT,
    "licenses" JSONB NOT NULL DEFAULT '[]',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "status" "PropertyStatus" NOT NULL DEFAULT 'DRAFT',
    "name" VARCHAR(160) NOT NULL,
    "city" "City" NOT NULL,
    "prefecture" "Prefecture" NOT NULL,
    "neighborhood" VARCHAR(120) NOT NULL,
    "approximateAddress" VARCHAR(255) NOT NULL,
    "exactAddressEnc" BYTEA,
    "latitude" DECIMAL(8,5) NOT NULL,
    "longitude" DECIMAL(8,5) NOT NULL,
    "type" "PropertyType" NOT NULL,
    "layout" VARCHAR(80),
    "structure" VARCHAR(160) NOT NULL,
    "floorAreaM2" DECIMAL(10,2) NOT NULL,
    "landAreaM2" DECIMAL(10,2),
    "yearBuilt" INTEGER NOT NULL,
    "nearestStation" VARCHAR(120) NOT NULL,
    "walkMinutes" INTEGER NOT NULL,
    "condition" "PropertyCondition" NOT NULL,
    "rentalStatus" "RentalStatus" NOT NULL,
    "summary" VARCHAR(400) NOT NULL,
    "description" TEXT NOT NULL,
    "highlights" TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_translations" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "locale" VARCHAR(5) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "summary" VARCHAR(400) NOT NULL,
    "description" TEXT NOT NULL,
    "highlights" TEXT[],

    CONSTRAINT "property_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_risks" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "detail" TEXT NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "property_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_images" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "storageKey" VARCHAR(512) NOT NULL,
    "alt" VARCHAR(255) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_documents" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "offeringId" UUID,
    "type" "DocumentType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "accessLevel" "DocumentAccessLevel" NOT NULL DEFAULT 'VERIFIED',
    "storageKey" VARCHAR(512) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMPTZ(3),
    "uploadedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_valuations" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "appraisedValue" BIGINT NOT NULL,
    "method" VARCHAR(160) NOT NULL,
    "appraiser" VARCHAR(200) NOT NULL,
    "appraisedAt" TIMESTAMPTZ(3) NOT NULL,
    "reportDocumentId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_financials" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "purchasePrice" BIGINT NOT NULL,
    "acquisitionCosts" BIGINT NOT NULL DEFAULT 0,
    "renovationCosts" BIGINT NOT NULL DEFAULT 0,
    "reserves" BIGINT NOT NULL DEFAULT 0,
    "annualGrossRent" BIGINT NOT NULL,
    "occupancyBps" INTEGER NOT NULL,
    "annualOperatingExpenses" BIGINT NOT NULL,
    "annualPropertyTax" BIGINT NOT NULL,
    "propertyManagementFeeBps" INTEGER NOT NULL,
    "platformFeeBps" INTEGER NOT NULL,
    "subscriptionFeeBps" INTEGER NOT NULL,
    "notes" TEXT,
    "createdById" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_financials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_ownerships" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "legalEntityId" UUID NOT NULL,
    "ownershipType" "OwnershipType" NOT NULL,
    "shareBps" INTEGER NOT NULL DEFAULT 10000,
    "registryReference" VARCHAR(120),
    "validFrom" TIMESTAMPTZ(3) NOT NULL,
    "validTo" TIMESTAMPTZ(3),

    CONSTRAINT "property_ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_properties" (
    "userId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_properties_pkey" PRIMARY KEY ("userId", "propertyId")
);

-- CreateTable
CREATE TABLE "token_offerings" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "issuerEntityId" UUID NOT NULL,
    "financialId" UUID,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "legalStructure" "LegalStructure" NOT NULL,
    "status" "OfferingStatus" NOT NULL DEFAULT 'DRAFT',
    "tokenName" VARCHAR(120) NOT NULL,
    "tokenSymbol" VARCHAR(16) NOT NULL,
    "totalTokens" BIGINT NOT NULL,
    "tokenPrice" BIGINT NOT NULL,
    "tokensSold" BIGINT NOT NULL DEFAULT 0,
    "tokensReserved" BIGINT NOT NULL DEFAULT 0,
    "minimumInvestment" BIGINT NOT NULL,
    "maximumInvestment" BIGINT,
    "opensAt" TIMESTAMPTZ(3),
    "closesAt" TIMESTAMPTZ(3),
    "lockupUntil" TIMESTAMPTZ(3),
    "economicRights" TEXT NOT NULL,
    "transferRestrictions" TEXT NOT NULL,
    "votingRights" TEXT,
    "legalApprovalRef" VARCHAR(200),
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "token_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_contracts" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "chainId" INTEGER NOT NULL,
    "network" VARCHAR(60) NOT NULL,
    "standard" "TokenStandard" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'PLANNED',
    "address" VARCHAR(42),
    "identityRegistry" VARCHAR(42),
    "complianceModule" VARCHAR(42),
    "adminMultisig" VARCHAR(42),
    "deployTxHash" VARCHAR(66),
    "deployedBlock" BIGINT,
    "deployedAt" TIMESTAMPTZ(3),
    "auditReportDocumentId" UUID,
    "lastIndexedBlock" BIGINT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "token_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "chainId" INTEGER NOT NULL,
    "address" VARCHAR(42) NOT NULL,
    "type" "WalletType" NOT NULL,
    "status" "WalletStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "custodyProvider" VARCHAR(60),
    "custodyReference" VARCHAR(120),
    "ownershipProofAt" TIMESTAMPTZ(3),
    "whitelistedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_orders" (
    "id" UUID NOT NULL,
    "reference" VARCHAR(32) NOT NULL,
    "userId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "tokens" BIGINT NOT NULL,
    "tokenPrice" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "feeAmount" BIGINT NOT NULL DEFAULT 0,
    "totalAmount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'JPY',
    "idempotencyKey" VARCHAR(80) NOT NULL,
    "eligibilitySnapshot" JSONB NOT NULL,
    "isSimulated" BOOLEAN NOT NULL DEFAULT true,
    "documentsAcceptedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscription_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_document_acceptances" (
    "orderId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_document_acceptances_pkey" PRIMARY KEY ("orderId", "documentId")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "orderId" UUID,
    "direction" "PaymentDirection" NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "providerReference" VARCHAR(120),
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "amount" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'JPY',
    "originalAmountMinor" BIGINT,
    "originalCurrency" CHAR(3),
    "fxRateId" UUID,
    "idempotencyKey" VARCHAR(80) NOT NULL,
    "failureCode" VARCHAR(80),
    "refundedAmount" BIGINT NOT NULL DEFAULT 0,
    "settledAt" TIMESTAMPTZ(3),
    "reconciledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "type" "PaymentEventType" NOT NULL,
    "providerEventId" VARCHAR(120),
    "webhookId" UUID,
    "amount" BIGINT,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_webhooks" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "eventId" VARCHAR(120) NOT NULL,
    "eventType" VARCHAR(80) NOT NULL,
    "signatureVerified" BOOLEAN NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "error" TEXT,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),

    CONSTRAINT "inbound_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rates" (
    "id" UUID NOT NULL,
    "base" CHAR(3) NOT NULL,
    "quote" CHAR(3) NOT NULL,
    "rate" DECIMAL(20,10) NOT NULL,
    "source" VARCHAR(80) NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_allocations" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "walletId" UUID,
    "tokens" BIGINT NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'PENDING',
    "chainId" INTEGER,
    "txHash" VARCHAR(66),
    "blockNumber" BIGINT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "mintedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "token_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investments" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "tokens" BIGINT NOT NULL,
    "investedAmount" BIGINT NOT NULL,
    "firstInvestedAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_income" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "periodMonth" DATE NOT NULL,
    "amount" BIGINT NOT NULL,
    "unitLabel" VARCHAR(40),
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,
    "sourceDocumentId" UUID,
    "recordedById" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_expenses" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" BIGINT NOT NULL,
    "incurredAt" DATE NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "invoiceDocumentId" UUID,
    "recordedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distributions" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "DistributionStatus" NOT NULL DEFAULT 'DRAFT',
    "grossIncome" BIGINT NOT NULL,
    "operatingExpenses" BIGINT NOT NULL,
    "taxes" BIGINT NOT NULL,
    "reserveAllocation" BIGINT NOT NULL DEFAULT 0,
    "fees" BIGINT NOT NULL,
    "distributableAmount" BIGINT NOT NULL,
    "recordDate" TIMESTAMPTZ(3),
    "snapshotBlock" BIGINT,
    "paymentDate" DATE,
    "preparedById" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(3),
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "distribution_allocations" (
    "id" UUID NOT NULL,
    "distributionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "investmentId" UUID NOT NULL,
    "tokensAtRecord" BIGINT NOT NULL,
    "grossAmount" BIGINT NOT NULL,
    "withholdingTaxBps" INTEGER NOT NULL DEFAULT 0,
    "withholdingTax" BIGINT NOT NULL DEFAULT 0,
    "netAmount" BIGINT NOT NULL,
    "status" "DistributionAllocationStatus" NOT NULL DEFAULT 'PENDING',
    "holdReason" TEXT,
    "paymentId" UUID,
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "distribution_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secondary_market_orders" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "side" "OrderSide" NOT NULL,
    "tokens" BIGINT NOT NULL,
    "pricePerToken" BIGINT NOT NULL,
    "status" "SecondaryOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "isSimulated" BOOLEAN NOT NULL DEFAULT true,
    "lockupCheckedAt" TIMESTAMPTZ(3),
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "secondary_market_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'JPY',
    "offeringId" UUID,
    "userId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "externalKey" VARCHAR(160) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_postings" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "amount" BIGINT NOT NULL,

    CONSTRAINT "ledger_postings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "offeringId" UUID,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "amount" BIGINT,
    "tokens" BIGINT,
    "reference" VARCHAR(80) NOT NULL,
    "orderId" UUID,
    "paymentId" UUID,
    "allocationId" UUID,
    "distributionAllocationId" UUID,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMPTZ(3),
    "sentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "ActorType" NOT NULL,
    "actorUserId" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entityType" VARCHAR(60) NOT NULL,
    "entityId" VARCHAR(80) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "requestId" VARCHAR(64),
    "ipHash" CHAR(64),
    "userAgent" VARCHAR(512),
    "prevHash" CHAR(64),
    "hash" CHAR(64) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "key" VARCHAR(80) NOT NULL,
    "scope" VARCHAR(120) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "lockedUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("scope", "key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE INDEX "user_profiles_countryOfResidence_idx" ON "user_profiles"("countryOfResidence");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_revokedAt_idx" ON "sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_tokenHash_key" ON "auth_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_tokens_userId_type_idx" ON "auth_tokens"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_verifications_provider_providerReference_key" ON "kyc_verifications"("provider", "providerReference");

-- CreateIndex
CREATE INDEX "kyc_verifications_userId_status_idx" ON "kyc_verifications"("userId", "status");

-- CreateIndex
CREATE INDEX "kyc_verifications_status_submittedAt_idx" ON "kyc_verifications"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "kyc_checks_verificationId_idx" ON "kyc_checks"("verificationId");

-- CreateIndex
CREATE INDEX "beneficial_owners_userId_idx" ON "beneficial_owners"("userId");

-- CreateIndex
CREATE INDEX "investor_eligibilities_userId_assessedAt_idx" ON "investor_eligibilities"("userId", "assessedAt");

-- CreateIndex
CREATE INDEX "consents_userId_type_idx" ON "consents"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "legal_entities_corporateNumber_key" ON "legal_entities"("corporateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "properties_slug_key" ON "properties"("slug");

-- CreateIndex
CREATE INDEX "properties_status_city_idx" ON "properties"("status", "city");

-- CreateIndex
CREATE INDEX "properties_status_type_idx" ON "properties"("status", "type");

-- CreateIndex
CREATE INDEX "properties_status_featured_publishedAt_idx" ON "properties"("status", "featured", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "property_translations_propertyId_locale_key" ON "property_translations"("propertyId", "locale");

-- CreateIndex
CREATE INDEX "property_risks_propertyId_sortOrder_idx" ON "property_risks"("propertyId", "sortOrder");

-- CreateIndex
CREATE INDEX "property_images_propertyId_sortOrder_idx" ON "property_images"("propertyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "property_documents_propertyId_type_version_key" ON "property_documents"("propertyId", "type", "version");

-- CreateIndex
CREATE INDEX "property_documents_offeringId_idx" ON "property_documents"("offeringId");

-- CreateIndex
CREATE INDEX "property_valuations_propertyId_appraisedAt_idx" ON "property_valuations"("propertyId", "appraisedAt");

-- CreateIndex
CREATE UNIQUE INDEX "property_financials_propertyId_version_key" ON "property_financials"("propertyId", "version");

-- CreateIndex
CREATE INDEX "property_financials_propertyId_isCurrent_idx" ON "property_financials"("propertyId", "isCurrent");

-- CreateIndex
CREATE INDEX "property_ownerships_propertyId_validTo_idx" ON "property_ownerships"("propertyId", "validTo");

-- CreateIndex
CREATE INDEX "favorite_properties_propertyId_idx" ON "favorite_properties"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "token_offerings_tokenSymbol_key" ON "token_offerings"("tokenSymbol");

-- CreateIndex
CREATE INDEX "token_offerings_propertyId_status_idx" ON "token_offerings"("propertyId", "status");

-- CreateIndex
CREATE INDEX "token_offerings_status_opensAt_idx" ON "token_offerings"("status", "opensAt");

-- CreateIndex
CREATE UNIQUE INDEX "token_contracts_offeringId_key" ON "token_contracts"("offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "token_contracts_chainId_address_key" ON "token_contracts"("chainId", "address");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_chainId_address_key" ON "wallets"("chainId", "address");

-- CreateIndex
CREATE INDEX "wallets_userId_idx" ON "wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_orders_reference_key" ON "subscription_orders"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_orders_userId_idempotencyKey_key" ON "subscription_orders"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "subscription_orders_offeringId_status_idx" ON "subscription_orders"("offeringId", "status");

-- CreateIndex
CREATE INDEX "subscription_orders_userId_createdAt_idx" ON "subscription_orders"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "subscription_orders_status_expiresAt_idx" ON "subscription_orders"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_providerReference_key" ON "payments"("provider", "providerReference");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_status_createdAt_idx" ON "payments"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_paymentId_providerEventId_key" ON "payment_transactions"("paymentId", "providerEventId");

-- CreateIndex
CREATE INDEX "payment_transactions_paymentId_occurredAt_idx" ON "payment_transactions"("paymentId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_webhooks_provider_eventId_key" ON "inbound_webhooks"("provider", "eventId");

-- CreateIndex
CREATE INDEX "inbound_webhooks_status_receivedAt_idx" ON "inbound_webhooks"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "fx_rates_base_quote_observedAt_source_key" ON "fx_rates"("base", "quote", "observedAt", "source");

-- CreateIndex
CREATE INDEX "fx_rates_base_quote_observedAt_idx" ON "fx_rates"("base", "quote", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "token_allocations_orderId_key" ON "token_allocations"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "token_allocations_chainId_txHash_key" ON "token_allocations"("chainId", "txHash");

-- CreateIndex
CREATE INDEX "token_allocations_offeringId_status_idx" ON "token_allocations"("offeringId", "status");

-- CreateIndex
CREATE INDEX "token_allocations_userId_idx" ON "token_allocations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "investments_userId_offeringId_key" ON "investments"("userId", "offeringId");

-- CreateIndex
CREATE INDEX "investments_offeringId_idx" ON "investments"("offeringId");

-- CreateIndex
CREATE INDEX "rental_income_propertyId_periodMonth_idx" ON "rental_income"("propertyId", "periodMonth");

-- CreateIndex
CREATE INDEX "property_expenses_propertyId_incurredAt_idx" ON "property_expenses"("propertyId", "incurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "distributions_offeringId_periodStart_periodEnd_key" ON "distributions"("offeringId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "distributions_status_paymentDate_idx" ON "distributions"("status", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "distribution_allocations_distributionId_userId_key" ON "distribution_allocations"("distributionId", "userId");

-- CreateIndex
CREATE INDEX "distribution_allocations_userId_idx" ON "distribution_allocations"("userId");

-- CreateIndex
CREATE INDEX "secondary_market_orders_offeringId_side_status_idx" ON "secondary_market_orders"("offeringId", "side", "status");

-- CreateIndex
CREATE INDEX "secondary_market_orders_userId_idx" ON "secondary_market_orders"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_code_key" ON "ledger_accounts"("code");

-- CreateIndex
CREATE INDEX "ledger_accounts_offeringId_idx" ON "ledger_accounts"("offeringId");

-- CreateIndex
CREATE INDEX "ledger_accounts_userId_idx" ON "ledger_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_externalKey_key" ON "journal_entries"("externalKey");

-- CreateIndex
CREATE INDEX "ledger_postings_entryId_idx" ON "ledger_postings"("entryId");

-- CreateIndex
CREATE INDEX "ledger_postings_accountId_idx" ON "ledger_postings"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_type_reference_key" ON "transactions"("type", "reference");

-- CreateIndex
CREATE INDEX "transactions_userId_occurredAt_idx" ON "transactions"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_hash_key" ON "audit_logs"("hash");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_occurredAt_idx" ON "audit_logs"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_logs_action_occurredAt_idx" ON "audit_logs"("action", "occurredAt");

-- CreateIndex
CREATE INDEX "idempotency_records_expiresAt_idx" ON "idempotency_records"("expiresAt");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_checks" ADD CONSTRAINT "kyc_checks_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "kyc_verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beneficial_owners" ADD CONSTRAINT "beneficial_owners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_eligibilities" ADD CONSTRAINT "investor_eligibilities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_translations" ADD CONSTRAINT "property_translations_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_risks" ADD CONSTRAINT "property_risks_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_documents" ADD CONSTRAINT "property_documents_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "token_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_valuations" ADD CONSTRAINT "property_valuations_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_financials" ADD CONSTRAINT "property_financials_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_ownerships" ADD CONSTRAINT "property_ownerships_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_ownerships" ADD CONSTRAINT "property_ownerships_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_properties" ADD CONSTRAINT "favorite_properties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_properties" ADD CONSTRAINT "favorite_properties_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_offerings" ADD CONSTRAINT "token_offerings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_offerings" ADD CONSTRAINT "token_offerings_issuerEntityId_fkey" FOREIGN KEY ("issuerEntityId") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_contracts" ADD CONSTRAINT "token_contracts_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "token_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_orders" ADD CONSTRAINT "subscription_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_orders" ADD CONSTRAINT "subscription_orders_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "token_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_document_acceptances" ADD CONSTRAINT "order_document_acceptances_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "subscription_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_document_acceptances" ADD CONSTRAINT "order_document_acceptances_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "property_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "subscription_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_fxRateId_fkey" FOREIGN KEY ("fxRateId") REFERENCES "fx_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "inbound_webhooks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_allocations" ADD CONSTRAINT "token_allocations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "subscription_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_allocations" ADD CONSTRAINT "token_allocations_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "token_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_allocations" ADD CONSTRAINT "token_allocations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_allocations" ADD CONSTRAINT "token_allocations_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "token_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_income" ADD CONSTRAINT "rental_income_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_expenses" ADD CONSTRAINT "property_expenses_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distributions" ADD CONSTRAINT "distributions_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "token_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_allocations" ADD CONSTRAINT "distribution_allocations_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "distributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_allocations" ADD CONSTRAINT "distribution_allocations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_allocations" ADD CONSTRAINT "distribution_allocations_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "investments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "distribution_allocations" ADD CONSTRAINT "distribution_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secondary_market_orders" ADD CONSTRAINT "secondary_market_orders_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "token_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secondary_market_orders" ADD CONSTRAINT "secondary_market_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_postings" ADD CONSTRAINT "ledger_postings_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_postings" ADD CONSTRAINT "ledger_postings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "token_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

