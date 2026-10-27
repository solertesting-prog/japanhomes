-- Database invariant tests. Run against a freshly migrated database:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/database/test/invariants.sql
-- Each block must FAIL for the right reason; a block that succeeds aborts the run.
-- Everything runs inside a transaction that is rolled back at the end.

BEGIN;

CREATE FUNCTION pg_temp.expect_failure(sql text, expected_state text, label text) RETURNS void AS $$
BEGIN
  BEGIN
    EXECUTE sql;
  EXCEPTION WHEN others THEN
    IF SQLSTATE <> expected_state THEN
      RAISE EXCEPTION 'FAIL %: expected SQLSTATE %, got % (%)', label, expected_state, SQLSTATE, SQLERRM;
    END IF;
    RAISE NOTICE 'ok   %', label;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL %: statement succeeded but should have been rejected', label;
END;
$$ LANGUAGE plpgsql;

-- Fixtures -------------------------------------------------------------------
INSERT INTO users (id, email, "passwordHash", "updatedAt") VALUES
  ('10000000-0000-4000-8000-000000000001', 'investor@example.test', 'argon2id$test', now()),
  ('10000000-0000-4000-8000-000000000002', 'staff@example.test', 'argon2id$test', now());

INSERT INTO legal_entities (id, name, type, role, "updatedAt") VALUES
  ('20000000-0000-4000-8000-000000000001', 'Test SPV GK', 'GODO_KAISHA', 'ISSUER_SPV', now());

INSERT INTO properties (id, slug, name, city, prefecture, neighborhood, "approximateAddress", latitude, longitude, type,
  structure, "floorAreaM2", "yearBuilt", "nearestStation", "walkMinutes", condition, "rentalStatus", summary, description, "updatedAt")
VALUES ('30000000-0000-4000-8000-000000000001', 'test-property', 'Test', 'TOKYO', 'TOKYO', 'Shibuya', 'Shibuya-ku', 35.65, 139.71,
  'APARTMENT', 'RC', 38.5, 2009, 'Shibuya', 9, 'GOOD', 'LEASED', 's', 'd', now());

INSERT INTO token_offerings (id, "propertyId", "issuerEntityId", "isDemo", "legalStructure", status, "tokenName", "tokenSymbol",
  "totalTokens", "tokenPrice", "minimumInvestment", "economicRights", "transferRestrictions", "updatedAt")
VALUES ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
  true, 'GK_TK_SILENT_PARTNERSHIP', 'OPEN', 'Test token', 'JPT-TEST', 30000, 1000, 50000, 'r', 't', now());

-- Tests ------------------------------------------------------------------------
SELECT pg_temp.expect_failure(
  $q$UPDATE token_offerings SET "tokensSold" = 29000, "tokensReserved" = 1001 WHERE "tokenSymbol" = 'JPT-TEST'$q$,
  '23514', 'round cannot be oversold');

SELECT pg_temp.expect_failure(
  $q$INSERT INTO token_offerings (id, "propertyId", "issuerEntityId", "isDemo", "legalStructure", status, "tokenName", "tokenSymbol",
     "totalTokens", "tokenPrice", "minimumInvestment", "economicRights", "transferRestrictions", "updatedAt")
     VALUES ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
     false, 'GK_TK_SILENT_PARTNERSHIP', 'OPEN', 'Real', 'JPT-REAL', 100, 1000, 1000, 'r', 't', now())$q$,
  '23514', 'real offering cannot open without legal approval reference');

SELECT pg_temp.expect_failure(
  $q$INSERT INTO subscription_orders (id, reference, "userId", "offeringId", tokens, "tokenPrice", amount, "totalAmount",
     "idempotencyKey", "eligibilitySnapshot", "updatedAt")
     VALUES (gen_random_uuid(), 'JPT-T-1', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
     100, 1000, 99999, 99999, 'k1', '{}', now())$q$,
  '23514', 'order amount must equal tokens × price');

SELECT pg_temp.expect_failure(
  $q$INSERT INTO users (id, email, "passwordHash", "updatedAt") VALUES (gen_random_uuid(), 'Mixed@Example.test', 'x', now())$q$,
  '23514', 'emails are stored normalised');

SELECT pg_temp.expect_failure(
  $q$INSERT INTO secondary_market_orders (id, "offeringId", "userId", side, tokens, "pricePerToken", "isSimulated", "updatedAt")
     VALUES (gen_random_uuid(), '40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'SELL', 10, 1000, false, now())$q$,
  '23514', 'secondary market accepts simulated orders only');

SELECT pg_temp.expect_failure(
  $q$INSERT INTO distributions (id, "offeringId", "periodStart", "periodEnd", "grossIncome", "operatingExpenses", taxes, fees,
     "distributableAmount", "updatedAt")
     VALUES (gen_random_uuid(), '40000000-0000-4000-8000-000000000001', '2026-07-01', '2026-09-30', 600000, 100000, 20000, 10000, 470001, now())$q$,
  '23514', 'distributable amount must follow the formula');

SELECT pg_temp.expect_failure(
  $q$INSERT INTO distributions (id, "offeringId", "periodStart", "periodEnd", "grossIncome", "operatingExpenses", taxes, fees,
     "distributableAmount", status, "preparedById", "approvedById", "approvedAt", "updatedAt")
     VALUES (gen_random_uuid(), '40000000-0000-4000-8000-000000000001', '2026-04-01', '2026-06-30', 600000, 100000, 20000, 10000, 470000,
     'APPROVED', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', now(), now())$q$,
  '23514', 'preparer cannot approve their own distribution');

-- Ledger: unbalanced entry is rejected when the deferred trigger fires.
INSERT INTO ledger_accounts (id, code, name, type) VALUES
  ('50000000-0000-4000-8000-000000000001', 'client_money:JPY', 'Client money', 'ASSET'),
  ('50000000-0000-4000-8000-000000000002', 'subscriptions_payable:JPT-TEST', 'Subscriptions payable', 'LIABILITY');

SELECT pg_temp.expect_failure(
  $q$DO $do$ BEGIN
     INSERT INTO journal_entries (id, "externalKey", description, "occurredAt") VALUES ('60000000-0000-4000-8000-000000000001', 'bad', 'bad', now());
     INSERT INTO ledger_postings (id, "entryId", "accountId", amount) VALUES
       (gen_random_uuid(), '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 100000),
       (gen_random_uuid(), '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', -99999);
     SET CONSTRAINTS ALL IMMEDIATE;
   END $do$$q$,
  '23514', 'journal entries must balance');

-- A balanced entry is accepted.
INSERT INTO journal_entries (id, "externalKey", description, "occurredAt") VALUES ('60000000-0000-4000-8000-000000000002', 'good', 'Subscription received', now());
INSERT INTO ledger_postings (id, "entryId", "accountId", amount) VALUES
  (gen_random_uuid(), '60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 100000),
  (gen_random_uuid(), '60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', -100000);
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;
DO $$ BEGIN RAISE NOTICE 'ok   balanced journal entry accepted'; END $$;

SELECT pg_temp.expect_failure(
  $q$UPDATE ledger_postings SET amount = 1 WHERE "entryId" = '60000000-0000-4000-8000-000000000002'$q$,
  '42501', 'ledger postings are immutable');

-- Audit log is append-only.
INSERT INTO audit_logs ("actorType", action, "entityType", "entityId", hash)
  VALUES ('SYSTEM', 'test.created', 'test', '1', repeat('a', 64));
SELECT pg_temp.expect_failure($q$UPDATE audit_logs SET action = 'tampered'$q$, '42501', 'audit log rows cannot be updated');
SELECT pg_temp.expect_failure($q$DELETE FROM audit_logs$q$, '42501', 'audit log rows cannot be deleted');

-- Distributions cannot be over-allocated.
INSERT INTO investments (id, "userId", "offeringId", tokens, "investedAmount", "firstInvestedAt", "updatedAt")
  VALUES ('70000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 100, 100000, now(), now());
INSERT INTO distributions (id, "offeringId", "periodStart", "periodEnd", "grossIncome", "operatingExpenses", taxes, fees, "distributableAmount", "updatedAt")
  VALUES ('80000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '2026-01-01', '2026-03-31', 1000, 0, 0, 0, 1000, now());
SELECT pg_temp.expect_failure(
  $q$DO $do$ BEGIN
     INSERT INTO distribution_allocations (id, "distributionId", "userId", "investmentId", "tokensAtRecord", "grossAmount", "netAmount")
     VALUES (gen_random_uuid(), '80000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
             '70000000-0000-4000-8000-000000000001', 100, 1001, 1001);
     SET CONSTRAINTS ALL IMMEDIATE;
   END $do$$q$,
  '23514', 'distribution cannot pay out more than is distributable');

DO $$ BEGIN RAISE NOTICE 'ALL DATABASE INVARIANT TESTS PASSED'; END $$;

ROLLBACK;
