/**
 * Port to whatever issues the tokens on-chain. In production this is a
 * regulated custodian's API (it holds the agent keys and broadcasts the
 * transactions); the platform never holds private keys. Every write takes an
 * idempotency `ref`: submitting the same ref twice returns the same tx.
 */

export interface DeployInput {
  ref: string;
  offeringRef: string;
  name: string;
  symbol: string;
  maxSupply: bigint;
  /** ISO 3166-1 alpha-2 codes allowed to hold the token; null = no country rule. */
  allowedCountries: string[] | null;
}

export interface DeployResult {
  token: string;
  identityRegistry: string;
  compliance: string;
  txHash: string;
  blockNumber: bigint;
}

export interface RegisterIdentityInput {
  ref: string;
  identityRegistry: string;
  wallet: string;
  /** Opaque 0x-prefixed 32-byte id; never personal data. */
  investorId: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  expiresAt: Date;
}

export interface MintInput {
  ref: string;
  token: string;
  to: string;
  amount: bigint;
}

export type ReceiptStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'UNKNOWN';

export interface TxReceipt {
  status: ReceiptStatus;
  blockNumber: bigint | null;
  confirmations: number;
  /** Revert reason for FAILED. */
  error: string | null;
}

export abstract class ChainGateway {
  abstract readonly kind: 'simulated';
  abstract readonly chainId: number;
  abstract readonly network: string;

  abstract head(): Promise<bigint>;
  abstract deploy(input: DeployInput): Promise<DeployResult>;
  abstract registerIdentity(input: RegisterIdentityInput): Promise<{ txHash: string }>;
  abstract mint(input: MintInput): Promise<{ txHash: string }>;
  abstract receipt(txHash: string): Promise<TxReceipt>;
  abstract balanceOf(token: string, wallet: string): Promise<bigint>;
  abstract totalSupply(token: string): Promise<bigint>;
}

/** "JP" → 0x4A50, the packing the IdentityRegistry contract uses. */
export function packCountry(alpha2: string): number {
  const c = alpha2.toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) throw new Error(`Invalid ISO 3166-1 alpha-2 code: ${alpha2}`);
  return (c.charCodeAt(0) << 8) | c.charCodeAt(1);
}
