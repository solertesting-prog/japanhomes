-- =============================================================================
-- Invariants Prisma's schema language cannot express.
-- These are the database's last line of defence: application bugs must not be
-- able to oversell a round, unbalance the ledger, or rewrite the audit trail.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_normalised_chk" CHECK ("email" = lower(btrim("email"))),
  ADD CONSTRAINT "users_failed_login_chk" CHECK ("failedLoginCount" >= 0);

ALTER TABLE "user_profiles"
  ADD CONSTRAINT "user_profiles_country_chk" CHECK ("countryOfResidence" IS NULL OR "countryOfResidence" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "user_profiles_nationality_chk" CHECK ("nationality" IS NULL OR "nationality" ~ '^[A-Z]{2}$');

ALTER TABLE "beneficial_owners"
  ADD CONSTRAINT "beneficial_owners_bps_chk" CHECK ("ownershipBps" BETWEEN 0 AND 10000);

-- ---------------------------------------------------------------------------
-- Property economics
-- ---------------------------------------------------------------------------
ALTER TABLE "properties"
  ADD CONSTRAINT "properties_year_chk" CHECK ("yearBuilt" BETWEEN 1600 AND 2100),
  ADD CONSTRAINT "properties_area_chk" CHECK ("floorAreaM2" > 0 AND ("landAreaM2" IS NULL OR "landAreaM2" > 0)),
  ADD CONSTRAINT "properties_walk_chk" CHECK ("walkMinutes" >= 0),
  ADD CONSTRAINT "properties_slug_chk" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  ADD CONSTRAINT "properties_published_chk" CHECK ("status" <> 'PUBLISHED' OR "publishedAt" IS NOT NULL);

ALTER TABLE "property_financials"
  ADD CONSTRAINT "property_financials_money_chk" CHECK (
    "purchasePrice" > 0 AND "acquisitionCosts" >= 0 AND "renovationCosts" >= 0 AND "reserves" >= 0
    AND "annualGrossRent" >= 0 AND "annualOperatingExpenses" >= 0 AND "annualPropertyTax" >= 0),
  ADD CONSTRAINT "property_financials_bps_chk" CHECK (
    "occupancyBps" BETWEEN 0 AND 10000 AND "propertyManagementFeeBps" BETWEEN 0 AND 10000
    AND "platformFeeBps" BETWEEN 0 AND 10000 AND "subscriptionFeeBps" BETWEEN 0 AND 10000);

-- Exactly one current set of assumptions per property.
CREATE UNIQUE INDEX "property_financials_one_current_idx"
  ON "property_financials"("propertyId") WHERE "isCurrent";

ALTER TABLE "property_valuations" ADD CONSTRAINT "property_valuations_value_chk" CHECK ("appraisedValue" > 0);
ALTER TABLE "property_ownerships" ADD CONSTRAINT "property_ownerships_bps_chk" CHECK ("shareBps" BETWEEN 1 AND 10000);
ALTER TABLE "property_documents"
  ADD CONSTRAINT "property_documents_sha_chk" CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "property_documents_size_chk" CHECK ("sizeBytes" > 0);
ALTER TABLE "rental_income" ADD CONSTRAINT "rental_income_amount_chk" CHECK ("amount" >= 0);
ALTER TABLE "property_expenses" ADD CONSTRAINT "property_expenses_amount_chk" CHECK ("amount" >= 0);

-- ---------------------------------------------------------------------------
-- Offerings: the round can never be oversold
-- ---------------------------------------------------------------------------
ALTER TABLE "token_offerings"
  ADD CONSTRAINT "token_offerings_supply_chk" CHECK ("totalTokens" > 0 AND "tokenPrice" > 0),
  ADD CONSTRAINT "token_offerings_counters_chk" CHECK (
    "tokensSold" >= 0 AND "tokensReserved" >= 0 AND "tokensSold" + "tokensReserved" <= "totalTokens"),
  ADD CONSTRAINT "token_offerings_limits_chk" CHECK (
    "minimumInvestment" > 0 AND ("maximumInvestment" IS NULL OR "maximumInvestment" >= "minimumInvestment")),
  ADD CONSTRAINT "token_offerings_window_chk" CHECK ("opensAt" IS NULL OR "closesAt" IS NULL OR "closesAt" > "opensAt"),
  ADD CONSTRAINT "token_offerings_symbol_chk" CHECK ("tokenSymbol" ~ '^[A-Z0-9-]{2,16}$'),
  -- A real (non-demo) offering cannot open without a recorded legal approval.
  ADD CONSTRAINT "token_offerings_legal_gate_chk" CHECK (
    "isDemo" OR "status" IN ('DRAFT', 'LEGAL_REVIEW', 'CANCELLED') OR "legalApprovalRef" IS NOT NULL);

ALTER TABLE "token_contracts"
  ADD CONSTRAINT "token_contracts_address_chk" CHECK ("address" IS NULL OR "address" ~ '^0x[0-9a-f]{40}$'),
  ADD CONSTRAINT "token_contracts_deployed_chk" CHECK ("status" = 'PLANNED' OR "address" IS NOT NULL);

ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_address_chk" CHECK ("address" ~ '^0x[0-9a-f]{40}$'),
  ADD CONSTRAINT "wallets_custody_chk" CHECK ("type" <> 'CUSTODIAL' OR "custodyProvider" IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Subscriptions and payments
-- ---------------------------------------------------------------------------
ALTER TABLE "subscription_orders"
  ADD CONSTRAINT "subscription_orders_amount_chk" CHECK (
    "tokens" > 0 AND "tokenPrice" > 0 AND "amount" = "tokens" * "tokenPrice"
    AND "feeAmount" >= 0 AND "totalAmount" = "amount" + "feeAmount"),
  ADD CONSTRAINT "subscription_orders_currency_chk" CHECK ("currency" = 'JPY');

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_chk" CHECK ("amount" > 0 AND "refundedAmount" BETWEEN 0 AND "amount"),
  ADD CONSTRAINT "payments_currency_chk" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "payments_fx_chk" CHECK (("originalCurrency" IS NULL) = ("originalAmountMinor" IS NULL));

ALTER TABLE "fx_rates" ADD CONSTRAINT "fx_rates_rate_chk" CHECK ("rate" > 0 AND "base" <> "quote");

ALTER TABLE "token_allocations" ADD CONSTRAINT "token_allocations_tokens_chk" CHECK ("tokens" > 0);
ALTER TABLE "investments" ADD CONSTRAINT "investments_amounts_chk" CHECK ("tokens" >= 0 AND "investedAmount" >= 0);

-- ---------------------------------------------------------------------------
-- Distributions: every yen accounted for
-- ---------------------------------------------------------------------------
ALTER TABLE "distributions"
  ADD CONSTRAINT "distributions_formula_chk" CHECK (
    "distributableAmount" = "grossIncome" - "operatingExpenses" - "taxes" - "reserveAllocation" - "fees"),
  ADD CONSTRAINT "distributions_non_negative_chk" CHECK (
    "grossIncome" >= 0 AND "operatingExpenses" >= 0 AND "taxes" >= 0 AND "reserveAllocation" >= 0
    AND "fees" >= 0 AND "distributableAmount" >= 0),
  ADD CONSTRAINT "distributions_period_chk" CHECK ("periodEnd" >= "periodStart"),
  ADD CONSTRAINT "distributions_approval_chk" CHECK (
    "status" NOT IN ('APPROVED', 'PAYING', 'PAID') OR ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL)),
  -- Four-eyes: whoever prepared a distribution cannot approve it.
  ADD CONSTRAINT "distributions_four_eyes_chk" CHECK ("approvedById" IS NULL OR "approvedById" IS DISTINCT FROM "preparedById");

ALTER TABLE "distribution_allocations"
  ADD CONSTRAINT "distribution_allocations_amount_chk" CHECK (
    "grossAmount" >= 0 AND "withholdingTax" >= 0 AND "netAmount" = "grossAmount" - "withholdingTax"),
  ADD CONSTRAINT "distribution_allocations_bps_chk" CHECK ("withholdingTaxBps" BETWEEN 0 AND 10000);

-- Sum of investor allocations may never exceed the approved distributable amount.
CREATE FUNCTION "jpt_check_distribution_total"() RETURNS trigger AS $$
DECLARE
  allocated BIGINT;
  available BIGINT;
BEGIN
  SELECT COALESCE(SUM("grossAmount"), 0) INTO allocated
    FROM "distribution_allocations" WHERE "distributionId" = NEW."distributionId";
  SELECT "distributableAmount" INTO available FROM "distributions" WHERE "id" = NEW."distributionId";
  IF allocated > available THEN
    RAISE EXCEPTION 'Distribution % over-allocated: % > %', NEW."distributionId", allocated, available
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "distribution_allocations_total_trg"
  AFTER INSERT OR UPDATE ON "distribution_allocations"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "jpt_check_distribution_total"();

-- ---------------------------------------------------------------------------
-- Secondary market stays simulated until a licensed venue exists.
-- Lifting this requires a reviewed migration, not a config change.
-- ---------------------------------------------------------------------------
ALTER TABLE "secondary_market_orders"
  ADD CONSTRAINT "secondary_market_orders_simulated_only_chk" CHECK ("isSimulated" = true),
  ADD CONSTRAINT "secondary_market_orders_amount_chk" CHECK ("tokens" > 0 AND "pricePerToken" > 0);

-- ---------------------------------------------------------------------------
-- Double-entry ledger: postings are immutable, entries must balance to zero.
-- ---------------------------------------------------------------------------
ALTER TABLE "ledger_postings" ADD CONSTRAINT "ledger_postings_non_zero_chk" CHECK ("amount" <> 0);

CREATE FUNCTION "jpt_check_journal_balanced"() RETURNS trigger AS $$
DECLARE
  total BIGINT;
  postings INTEGER;
BEGIN
  SELECT COALESCE(SUM("amount"), 0), COUNT(*) INTO total, postings
    FROM "ledger_postings" WHERE "entryId" = NEW."entryId";
  IF total <> 0 OR postings < 2 THEN
    RAISE EXCEPTION 'Journal entry % is not balanced (sum %, % postings)', NEW."entryId", total, postings
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ledger_postings_balanced_trg"
  AFTER INSERT ON "ledger_postings"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "jpt_check_journal_balanced"();

CREATE FUNCTION "jpt_forbid_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ledger_postings_immutable_trg"
  BEFORE UPDATE OR DELETE ON "ledger_postings"
  FOR EACH ROW EXECUTE FUNCTION "jpt_forbid_mutation"();

CREATE TRIGGER "journal_entries_immutable_trg"
  BEFORE UPDATE OR DELETE ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION "jpt_forbid_mutation"();

-- ---------------------------------------------------------------------------
-- Audit log: append-only, hash-chained.
-- ---------------------------------------------------------------------------
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_hash_chk" CHECK ("hash" ~ '^[0-9a-f]{64}$' AND ("prevHash" IS NULL OR "prevHash" ~ '^[0-9a-f]{64}$'));

CREATE TRIGGER "audit_logs_immutable_trg"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "jpt_forbid_mutation"();

CREATE TRIGGER "audit_logs_no_truncate_trg"
  BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "jpt_forbid_mutation"();
