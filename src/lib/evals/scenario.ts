import { createSeedData, demoId } from '../demo/seed-data';
import type { EvalCase } from './schemas';

// Only the isolated evaluator uses this; production seed data remains unchanged.
export function evaluationSeed(test: EvalCase, anchor = new Date()) {
  const seed = createSeedData(anchor);
  const scenario = test.fixture.scenario;
  if (!scenario) return seed;
  const ids = new Set(scenario.transactions.map(row => row.id));
  if (ids.size !== scenario.transactions.length) throw new Error('Duplicate scenario transaction.');
  for (const replacement of scenario.transactions) {
    const row = seed.transactions.find(row => row.id === replacement.id);
    if (!row || row.customer_id !== test.customer_id) throw new Error('Scenario must belong to the selected customer.');
    if ((replacement.status === 'declined') !== (replacement.decline_code !== null))
      throw new Error('Scenario decline evidence must match payment status.');
    Object.assign(row, replacement);
  }
  seed.refunds = seed.refunds.filter(row => !ids.has(row.transaction_id));
  const refunds = new Set<string>();
  for (const [index, refund] of scenario.refunds.entries()) {
    const transaction = seed.transactions.find(row => row.id === refund.transaction_id);
    if (!ids.has(refund.transaction_id) || !transaction || transaction.status !== 'succeeded' || refund.amount_cents > transaction.amount_cents || refunds.has(refund.transaction_id))
      throw new Error('Invalid scenario refund evidence.');
    refunds.add(refund.transaction_id);
    seed.refunds.push({ ...refund, id: demoId(9900 + index), currency: 'USD',
      idempotency_key: `release-fixture-${test.id}-${index}`, created_at: anchor.toISOString(), updated_at: anchor.toISOString() });
  }
  return seed;
}
