-- CreateEnum
CREATE TYPE "SimulatedTxKind" AS ENUM ('DEPLOY', 'REGISTER_IDENTITY', 'MINT');

-- CreateEnum
CREATE TYPE "SimulatedTxStatus" AS ENUM ('CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "simulated_chain_txs" (
    "txHash" VARCHAR(66) NOT NULL,
    "kind" "SimulatedTxKind" NOT NULL,
    "contract" VARCHAR(42) NOT NULL,
    "ref" VARCHAR(120) NOT NULL,
    "wallet" VARCHAR(42),
    "amount" BIGINT,
    "payload" JSONB,
    "status" "SimulatedTxStatus" NOT NULL,
    "error" VARCHAR(200),
    "blockNumber" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulated_chain_txs_pkey" PRIMARY KEY ("txHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "simulated_chain_txs_ref_key" ON "simulated_chain_txs"("ref");

-- CreateIndex
CREATE INDEX "simulated_chain_txs_contract_kind_idx" ON "simulated_chain_txs"("contract", "kind");
