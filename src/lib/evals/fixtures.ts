import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSeedData } from '../demo/seed-data';
import { customerSchema } from '../db/schemas';
import type { EvalCase } from './schemas';

export async function createEvalFixture(db: SupabaseClient, test: EvalCase, suiteId: string) {
  const seed = createSeedData();
  if (!seed.customers.some((row) => row.id === test.customer_id)) throw new Error('Unknown demo customer in evaluation fixture.');
  const map = new Map<string, string>();
  for (const row of [...seed.customers, ...seed.payment_methods, ...seed.transactions, ...seed.refunds]) map.set(row.id, randomUUID());
  const remap = (value: string) => map.get(value) ?? value;
  const messageIds: string[] = test.message.match(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gi) ?? [];
  for (const id of [...messageIds, ...test.expected_outcome.transaction_ids]) if (!map.has(id)) map.set(id, randomUUID());
  const owners = new Set([test.customer_id]);
  for (const transaction of seed.transactions) if (messageIds.includes(transaction.id)) owners.add(transaction.customer_id);
  const customers = seed.customers.filter((row) => owners.has(row.id)).map((row) => ({
    ...row, id: remap(row.id), email: `eval.${remap(row.id)}@example.invalid`,
    name: `${row.name} · eval`,
  }));
  const methods = seed.payment_methods.filter((row) => owners.has(row.customer_id)).map((row) => ({ ...row, id: remap(row.id), customer_id: remap(row.customer_id) }));
  const transactions = seed.transactions.filter((row) => owners.has(row.customer_id)).map((row) => ({
    ...row, id: remap(row.id), customer_id: remap(row.customer_id), payment_method_id: remap(row.payment_method_id),
    idempotency_key: `eval:${suiteId}:${test.id}:${row.id}`,
    merchant: row.id === test.expected_outcome.transaction_ids[0] && test.fixture.merchant ? test.fixture.merchant : row.merchant,
  }));
  const transactionIds = transactions.map((row) => row.id);
  const refunds = seed.refunds.filter((row) => transactionIds.includes(remap(row.transaction_id))).map((row) => ({
    ...row, id: remap(row.id), transaction_id: remap(row.transaction_id),
    idempotency_key: `eval:${suiteId}:${test.id}:${row.id}`,
    reason: test.fixture.refund_reason ?? row.reason,
  }));
  async function cleanup() {
    const { data, error } = await db.from('refunds').select('id').in('transaction_id', transactionIds);
    if (error) throw new Error('Eval fixture cleanup failed. Inspect fixture IDs in the trace before rerunning.');
    const ids = data.map((row) => row.id);
    const operations = [];
    if (ids.length) {
      operations.push(await db.from('refund_executions').delete().in('refund_id', ids));
      operations.push(await db.from('refunds').delete().in('id', ids));
    }
    operations.push(await db.from('transactions').delete().in('id', transactionIds));
    operations.push(await db.from('payment_methods').delete().in('id', methods.map((row) => row.id)));
    operations.push(await db.from('customers').delete().in('id', customers.map((row) => row.id)));
    if (operations.some((result) => result.error)) throw new Error('Eval fixture cleanup failed. Preserve the run details for diagnosis.');
  }
  try {
    const tables: [string, Record<string, unknown>[]][] = [['customers', customers], ['payment_methods', methods], ['transactions', transactions], ['refunds', refunds]];
    for (const [table, rows] of tables) {
      if (rows.length && (await db.from(table).insert(rows)).error) throw new Error('Could not create isolated evaluation fixtures. Check migrations and database access.');
    }
  } catch (error) { await cleanup(); throw error; }
  return {
    customer: customerSchema.parse(customers.find((row) => row.id === remap(test.customer_id))),
    message: test.message.replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/gi, remap), remap, cleanup,
  };
}
