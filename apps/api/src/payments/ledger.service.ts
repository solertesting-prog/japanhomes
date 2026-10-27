import { Injectable } from '@nestjs/common';
import type { Prisma } from '@jpt/database';

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export interface Posting {
  account: { code: string; name: string; type: AccountType; offeringId?: string; userId?: string };
  /** Signed yen: debit positive, credit negative. Zero postings are dropped. */
  amount: bigint;
}

/**
 * Double-entry ledger. The database refuses unbalanced entries and edits
 * (see invariants migration); `externalKey` makes every posting idempotent.
 */
@Injectable()
export class LedgerService {
  async post(tx: Prisma.TransactionClient, externalKey: string, description: string, postings: Posting[]): Promise<boolean> {
    const existing = await tx.journalEntry.findUnique({ where: { externalKey } });
    if (existing) return false;
    const lines = postings.filter((p) => p.amount !== 0n);
    const sum = lines.reduce((a, p) => a + p.amount, 0n);
    if (sum !== 0n || lines.length < 2) throw new Error(`Unbalanced journal entry ${externalKey}: sum ${sum}`);
    const entry = await tx.journalEntry.create({ data: { externalKey, description, occurredAt: new Date() } });
    for (const line of lines) {
      const account = await tx.ledgerAccount.upsert({
        where: { code: line.account.code },
        create: {
          code: line.account.code,
          name: line.account.name,
          type: line.account.type,
          offeringId: line.account.offeringId ?? null,
          userId: line.account.userId ?? null,
        },
        update: {},
      });
      await tx.ledgerPosting.create({ data: { entryId: entry.id, accountId: account.id, amount: line.amount } });
    }
    return true;
  }
}

export const ACCOUNTS = {
  clientMoney: { code: 'client_money:JPY', name: 'Client money held (JPY)', type: 'ASSET' as const },
  subscriptionsPayable: (offeringId: string, symbol: string) => ({
    code: `subscriptions_payable:${symbol}`,
    name: `Subscriptions payable to issuer — ${symbol}`,
    type: 'LIABILITY' as const,
    offeringId,
  }),
  subscriptionFees: { code: 'fee_income:subscription', name: 'Subscription fee income', type: 'INCOME' as const },
  distributionsPayable: (offeringId: string, symbol: string) => ({
    code: `distributions_payable:${symbol}`,
    name: `Distributions payable to holders — ${symbol}`,
    type: 'LIABILITY' as const,
    offeringId,
  }),
  withholdingTaxPayable: { code: 'withholding_tax_payable:JPY', name: 'Withholding tax payable to the tax office', type: 'LIABILITY' as const },
};
