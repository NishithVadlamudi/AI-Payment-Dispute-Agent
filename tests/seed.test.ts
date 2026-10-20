import { describe, expect, it } from 'vitest';
import { createSeedData } from '../src/lib/demo/seed-data';
import { scenarios } from '../src/lib/demo/scenarios';
import { seed } from './helpers';

describe('repeatable mock seed', () => {
  it('contains 20 fictional customers, 300 integer-cent payments, and valid relationships', () => {
    expect(seed.customers).toHaveLength(20);
    expect(seed.transactions).toHaveLength(300);
    const ids = new Set(seed.customers.map((customer) => customer.id));
    for (const transaction of seed.transactions) {
      expect(Number.isInteger(transaction.amount_cents)).toBe(true);
      expect(transaction.amount_cents).toBeGreaterThan(0);
      expect(ids.has(transaction.customer_id)).toBe(true);
      expect(
        seed.payment_methods.some(
          (method) =>
            method.id === transaction.payment_method_id &&
            method.customer_id === transaction.customer_id,
        ),
      ).toBe(true);
    }
    expect(seed.customers.every((customer) => customer.email.endsWith('@example.com'))).toBe(true);
  });
  it('produces the same records for the same seed date with unique idempotency keys', () => {
    expect(createSeedData(new Date('2026-10-16T23:00:00Z'))).toEqual(seed);
    expect(new Set(seed.transactions.map((transaction) => transaction.idempotency_key)).size).toBe(
      300,
    );
    expect(new Set(seed.refunds.map((refund) => refund.idempotency_key)).size).toBe(2);
  });
  it('plants discoverable duplicate, decline, pending refund, and already refunded scenarios', () => {
    const duplicates = seed.transactions.filter(
      (transaction) =>
        transaction.customer_id === scenarios[0].customerId &&
        transaction.merchant === 'Northstar Electronics',
    );
    expect(duplicates).toHaveLength(2);
    expect(duplicates.map((transaction) => transaction.amount_cents)).toEqual([8499, 8499]);
    expect(duplicates[0].idempotency_key).not.toBe(duplicates[1].idempotency_key);
    expect(
      seed.transactions.find(
        (transaction) =>
          transaction.customer_id === scenarios[1].customerId && transaction.decline_code,
      )?.decline_code,
    ).toBe('insufficient_funds');
    expect(seed.refunds.map((refund) => refund.status)).toEqual(['pending', 'succeeded']);
    expect(
      seed.refunds.every((refund) =>
        seed.transactions.some(
          (transaction) =>
            transaction.id === refund.transaction_id &&
            transaction.amount_cents >= refund.amount_cents,
        ),
      ),
    ).toBe(true);
  });
});
