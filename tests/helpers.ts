import { vi } from 'vitest';
import { createSeedData } from '../src/lib/demo/seed-data';
import {
  customerSchema,
  transactionSchema,
  refundSchema,
  policySchema,
} from '../src/lib/db/schemas';
import type { DisputeStore } from '../src/lib/db/queries';

export const seed = createSeedData(new Date('2026-10-16T12:00:00Z'));
export const customers = seed.customers.map((customer) => customerSchema.parse(customer));
export const transactions = seed.transactions.map((transaction) =>
  transactionSchema.parse(transaction),
);
export const refunds = seed.refunds.map((refund) => refundSchema.parse(refund));
export function fakeStore(): DisputeStore {
  return {
    audit: vi.fn(async () => {}),
    requestRefund: vi.fn(async () => { throw new Error('No mock refund configured'); }),
    customers: vi.fn(async () => customers),
    customer: vi.fn(async (id) => customers.find((customer) => customer.id === id) ?? null),
    search: vi.fn(async (id, filters) => ({
      transactions: transactions.filter(
        (transaction) =>
          transaction.customer_id === id &&
          (filters.amount === undefined || filters.amount === transaction.amount_cents) &&
          (!filters.date_range ||
            (transaction.created_at >= filters.date_range.start &&
              transaction.created_at <= filters.date_range.end)),
      ),
      truncated: false,
    })),
    transaction: vi.fn(async (id, transactionId) => {
      const transaction = transactions.find(
        (transaction) => transaction.customer_id === id && transaction.id === transactionId,
      );
      return transaction
        ? {
            transaction,
            refunds: refunds.filter((refund) => refund.transaction_id === transactionId),
          }
        : null;
    }),
    policy: vi.fn(async (reason) => {
      const policy = seed.refund_policies.find((policy) => policy.reason === reason);
      return policy ? policySchema.parse(policy) : null;
    }),
  };
}
