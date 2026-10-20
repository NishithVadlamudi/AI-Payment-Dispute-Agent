import { afterAll, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createRefundStore } from '../src/lib/db/refunds';
import { createStore } from '../src/lib/db/queries';
import { executeTool } from '../src/lib/tools/execute';
import { demoId } from '../src/lib/demo/seed-data';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const refunds = createRefundStore(db);
const transactionIds: string[] = [];
const runIds: string[] = [];
async function charge(amount = 10000, status = 'succeeded') {
  const id = randomUUID();
  transactionIds.push(id);
  const { error } = await db.from('transactions').insert({
    id, customer_id: demoId(1), payment_method_id: demoId(100), amount_cents: amount,
    currency: 'USD', status, merchant: 'Phase 2 integration fixture',
    decline_code: status === 'declined' ? 'insufficient_funds' : null, idempotency_key: id,
  });
  if (error) throw error;
  return id;
}
function request(transaction_id: string, amount_cents = 10000, key = randomUUID(), customer = demoId(1)) {
  const runId = randomUUID();
  runIds.push(runId);
  return refunds.request(customer, { transaction_id, amount_cents, reason: 'Two matching successful charges; review suspected duplicate.' }, key, runId);
}
afterAll(async () => {
  const { data } = await db.from('refunds').select('id').in('transaction_id', transactionIds);
  const ids = data?.map((row) => row.id) ?? [];
  if (ids.length) {
    await db.from('refund_executions').delete().in('refund_id', ids);
    for (const id of ids) await db.from('audit_log').delete().eq('payload->>refund_id', id);
    await db.from('refunds').delete().in('id', ids);
  }
  if (runIds.length) await db.from('audit_log').delete().in('run_id', runIds);
  await db.from('transactions').delete().in('id', transactionIds);
});

describe('atomic mock refund workflow in Postgres', () => {
  it('requests approval, shows reviewer evidence, and issues nothing until approved', async () => {
    const id = await charge();
    const refund = await request(id);
    expect(refund.status).toBe('pending_approval');
    expect((await db.from('refund_executions').select('*').eq('refund_id', refund.id)).data).toEqual([]);
    expect((await refunds.queue()).find((row) => row.id === refund.id)).toMatchObject({
      reason: expect.stringContaining('suspected duplicate'), transaction: { id }, customer: { id: demoId(1) },
    });
    const audit = await db.from('audit_log').select('*').eq('payload->>refund_id', refund.id);
    expect(audit.data).toContainEqual(expect.objectContaining({ actor: 'agent', action: 'refund_requested' }));
    await refunds.decide(refund.id, 'reject');
  });
  it('reuses repeated requests and rejects conflicting idempotency parameters', async () => {
    const id = await charge();
    const key = randomUUID();
    const first = await request(id, 4000, key);
    expect((await request(id, 4000, key)).id).toBe(first.id);
    expect((await request(id, 4000)).id).toBe(first.id);
    await expect(request(id, 5000, key)).rejects.toThrow('different refund details');
    await expect(request(id, 5000)).rejects.toThrow('already awaiting review');
  });
  it('serializes concurrent requests, reserving only one outstanding approval', async () => {
    const id = await charge();
    const results = await Promise.all(Array.from({ length: 8 }, () => request(id, 6000)));
    expect(new Set(results.map((row) => row.id)).size).toBe(1);
    expect((await db.from('refunds').select('id').eq('transaction_id', id)).data).toHaveLength(1);
  });
  it('double-clicks, retries, and concurrent approvals execute exactly once', async () => {
    const refund = await request(await charge());
    const approvals = await Promise.all(Array.from({ length: 12 }, () => refunds.decide(refund.id, 'approve')));
    expect(approvals.every((row) => row.status === 'succeeded')).toBe(true);
    expect((await refunds.decide(refund.id, 'approve')).status).toBe('succeeded');
    const { data } = await db.from('refund_executions').select('*').eq('refund_id', refund.id);
    expect(data).toHaveLength(1);
    expect(data![0].amount_cents).toBe(10000);
    // Prove the database constraints reject duplicates independently of our function.
    const { id: ignored, ...entry } = data![0];
    void ignored;
    expect((await db.from('refund_executions').insert({ ...entry, idempotency_key: randomUUID() })).error?.code).toBe('23505');
    const other = await request(await charge());
    expect((await db.from('refund_executions').insert({ ...entry, refund_id: other.id })).error?.code).toBe('23505');
    const audit = await db.from('audit_log').select('action,actor').eq('payload->>refund_id', refund.id);
    expect(audit.data?.filter((row) => row.action === 'refund_approved')).toHaveLength(1);
    expect(audit.data?.filter((row) => row.action === 'refund_decision_replayed')).toHaveLength(12);
    await expect(refunds.decide(refund.id, 'reject')).rejects.toThrow('different decision');
  });
  it('rejects a request without execution and releases its balance', async () => {
    const id = await charge();
    const first = await request(id);
    expect((await refunds.decide(first.id, 'reject')).status).toBe('rejected');
    expect((await refunds.decide(first.id, 'reject')).status).toBe('rejected');
    await expect(refunds.decide(first.id, 'approve')).rejects.toThrow('different decision');
    expect((await db.from('refund_executions').select('*').eq('refund_id', first.id)).data).toEqual([]);
    expect((await request(id)).status).toBe('pending_approval');
  });
  it('serializes approval versus rejection so one decision wins', async () => {
    const refund = await request(await charge());
    const decisions = await Promise.allSettled([refunds.decide(refund.id, 'approve'), refunds.decide(refund.id, 'reject')]);
    expect(decisions.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(decisions.filter((row) => row.status === 'rejected')).toHaveLength(1);
    const final = (await db.from('refunds').select('status').eq('id', refund.id).single()).data!;
    const executions = (await db.from('refund_executions').select('id').eq('refund_id', refund.id)).data!;
    expect(executions).toHaveLength(final.status === 'succeeded' ? 1 : 0);
  });
  it('allows partial refunds only within the original charge less reserved and prior refunds', async () => {
    const id = await charge();
    await expect(request(id, 10001)).rejects.toThrow('remaining balance');
    const first = await request(id, 6000);
    await refunds.decide(first.id, 'approve');
    await expect(request(id, 4001)).rejects.toThrow('remaining balance');
    const second = await request(id, 4000);
    await refunds.decide(second.id, 'approve');
    await expect(request(id, 1)).rejects.toThrow('remaining balance');
    const executions = (await db.from('refund_executions').select('amount_cents').in('refund_id', [first.id, second.id])).data!;
    expect(executions.reduce((sum, row) => sum + row.amount_cents, 0)).toBe(10000);
    await expect(request(demoId(1030), 1, randomUUID(), demoId(3))).rejects.toThrow('remaining balance');
    await expect(request(demoId(1045), 1, randomUUID(), demoId(4))).rejects.toThrow('remaining balance');
  });
  it('blocks declined, pending, foreign-account, fractional and negative requests at the database boundary', async () => {
    await expect(request(await charge(10000, 'declined'))).rejects.toThrow('Only succeeded');
    await expect(request(await charge(10000, 'pending'))).rejects.toThrow('Only succeeded');
    await expect(request(await charge(), 10000, randomUUID(), demoId(2))).rejects.toThrow('not found');
    const id = await charge();
    await expect(request(id, -1)).rejects.toThrow('positive integer');
    await expect(request(id, 1.5)).rejects.toThrow();
  });
  it('rechecks settlement and balance during approval, rolling back without an execution', async () => {
    const id = await charge();
    const refund = await request(id);
    // Simulate a privileged data correction between proposal and human review.
    expect((await db.from('transactions').update({ status: 'pending' }).eq('id', id)).error).toBeNull();
    await expect(refunds.decide(refund.id, 'approve')).rejects.toThrow('Only succeeded');
    await db.from('transactions').update({ status: 'succeeded', amount_cents: 9000 }).eq('id', id);
    await expect(refunds.decide(refund.id, 'approve')).rejects.toThrow('remaining balance');
    expect((await db.from('refund_executions').select('*').eq('refund_id', refund.id)).data).toEqual([]);
    expect((await db.from('refunds').select('status').eq('id', refund.id).single()).data?.status).toBe('pending_approval');
  });
  it('audits successful and failed tool attempts with server-selected customer and run', async () => {
    const runId = randomUUID(); runIds.push(runId);
    const store = createStore(db);
    const context = { runId, callId: 'integration-audited' };
    const result = await executeTool('request_refund', { transaction_id: await charge(), amount_cents: 10000, reason: 'A duplicate charge for human review.' }, demoId(1), store, context);
    expect(result).toMatchObject({ requires_approval: true, refund: { status: 'pending_approval' } });
    await executeTool('approve_refund', {}, demoId(1), store, { runId, callId: 'unknown' });
    const logs = (await db.from('audit_log').select('*').eq('run_id', runId)).data!;
    expect(logs.filter((row) => row.action === 'tool_started')).toHaveLength(2);
    expect(logs.filter((row) => row.action === 'tool_finished')).toHaveLength(2);
    expect(logs.every((row) => row.customer_id === demoId(1) && row.actor === 'agent')).toBe(true);
    expect(logs.find((row) => row.action === 'tool_finished' && row.payload.call_id === 'unknown')?.payload.failed).toBe(true);
  });
  it('denies anonymous mutation RPCs and access to the execution ledger', async () => {
    const anonymous = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    expect((await anonymous.rpc('decide_demo_refund', { p_refund_id: randomUUID(), p_decision: 'approve' })).error).not.toBeNull();
    expect((await anonymous.rpc('request_demo_refund', { p_customer_id: demoId(1), p_transaction_id: demoId(1000), p_amount_cents: 100, p_reason: 'Injection attempt', p_idempotency_key: randomUUID(), p_run_id: randomUUID() })).error).not.toBeNull();
    expect((await anonymous.from('refund_executions').select('*')).data).toEqual([]);
  });
});
