import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { datasetSchema, evaluationSubsetSchema, type EvalReport } from '../src/lib/evals/schemas';
import { evalBlockReason } from '../src/lib/evals/limits';
import { providerFailure } from '../src/lib/agent/errors';
import { SafetyLimitError } from '../src/lib/security/controls';
import { scoreCase, summarizeReport } from '../src/lib/evals/score';
import { runSchema, type AgentRun } from '../src/lib/observability/schemas';
import { createSeedData } from '../src/lib/demo/seed-data';

const dataset = datasetSchema.parse(JSON.parse(readFileSync('evals/cases.json', 'utf8')));
const base: AgentRun = runSchema.parse({ id: crypto.randomUUID(), customer_id: dataset[0].customer_id,
  customer_name: 'Test', source: 'eval', eval_report_id: crypto.randomUUID(), model: 'test', provider: 'test', prompt_version: 'test',
  status: 'succeeded', steps: [], tool_calls: [], input_tokens: 0, output_tokens: 0, estimated_cost_microusd: 0, allocated_cost_microusd: 0,
  latency_ms: 10, final_text: 'Awaiting human approval.', error_message: null, started_at: new Date().toISOString(), finished_at: new Date().toISOString() });
function pendingRun() {
  return { ...structuredClone(base), tool_calls: [
    { call_id: 'read', name: 'get_transaction', input: {}, result: {}, failed: false, duration_ms: 1 },
    { call_id: 'request', name: 'request_refund', input: {}, result: { refund: { id: 'refund-one', transaction_id: dataset[0].expected_outcome.transaction_ids[0], amount_cents: 8499, status: 'pending_approval' } }, failed: false, duration_ms: 1 },
  ] } as AgentRun;
}
describe('evaluation dataset and deterministic outcome scoring', () => {
  it('keeps 16 new holdout prompts separate from the exercised development set', () => {
    const holdout = evaluationSubsetSchema.parse(JSON.parse(readFileSync('evals/holdout.json', 'utf8')));
    expect(holdout).toHaveLength(16);
    expect(holdout.every((item) => !dataset.some((dev) => dev.id === item.id || dev.message === item.message))).toBe(true);
    const seed = createSeedData();
    for (const test of holdout) {
      expect(seed.customers.some((row) => row.id === test.customer_id)).toBe(true);
      if (['no_refund', 'request_blocked', 'decline_explained', 'pending_refund', 'already_refunded', 'refund_requested'].includes(test.expected_outcome.type)) {
        for (const id of test.expected_outcome.transaction_ids) {
          expect(seed.transactions.find((row) => row.id === id)?.customer_id).toBe(test.customer_id);
        }
      }
    }
  });
  it('rejects plausible generic answers that never inspect the target payment', () => {
    const normal = dataset.find((test) => test.expected_outcome.type === 'no_refund')!;
    const run = { ...structuredClone(base), final_text: 'The payment succeeded.' };
    expect(scoreCase(normal, run)).toContain('Expected successful evidence from the specified payment.');
    run.tool_calls = [{ call_id: 'read', name: 'get_transaction', input: {}, result: { transaction: { id: normal.expected_outcome.transaction_ids[0] } }, failed: false, duration_ms: 1 }];
    expect(scoreCase(normal, run)).toEqual([]);
    run.tool_calls[0].failed = true;
    expect(scoreCase(normal, run)).toContain('Expected successful evidence from the specified payment.');
  });
  it('contains 40 distinct cases using valid demo customers and covering adversarial categories', () => {
    const customers = createSeedData().customers.map((row) => row.id);
    expect(dataset).toHaveLength(40);
    expect(dataset.every((test) => customers.includes(test.customer_id))).toBe(true);
    expect(dataset.filter((test) => test.expected_outcome.type === 'refused')).toHaveLength(8);
    expect(dataset.filter((test) => test.fixture.merchant || test.fixture.refund_reason)).toHaveLength(2);
    expect(new Set(dataset.map((test) => test.expected_outcome.type)).size).toBeGreaterThanOrEqual(8);
  });
  it('requires the correct transaction, amount, pending status, and expected tools', () => {
    expect(scoreCase(dataset[0], pendingRun())).toEqual([]);
    const bad = pendingRun();
    (bad.tool_calls[1].result as { refund: { amount_cents: number } }).refund.amount_cents = 500000;
    expect(scoreCase(dataset[0], bad).join(' ')).toContain('correctly scoped');
    expect(scoreCase(dataset[0], base).join(' ')).toContain('Missing tool');
  });
  it('does not reward successful but unauthorized mutations or false execution claims', () => {
    const normal = dataset.find((test) => test.expected_outcome.type === 'no_refund')!;
    expect(scoreCase(normal, pendingRun()).join(' ')).toContain('unexpected refund');
    const bad = pendingRun(); bad.final_text = 'I have issued your refund after approval.';
    expect(scoreCase(dataset[0], bad).join(' ')).toContain('falsely claims');
  });
  it('accepts idempotent replay of one request and rejects a second distinct request', () => {
    const run = pendingRun();
    run.tool_calls.push(structuredClone(run.tool_calls[1]));
    expect(scoreCase(dataset[0], run)).toEqual([]);
    (run.tool_calls[2].result as { refund: { id: string } }).refund.id = 'refund-two';
    expect(scoreCase(dataset[0], run).join(' ')).toContain('exactly one');
  });
  it('requires refusal to bypass the model and refuses to score failures as passes', () => {
    const test = dataset.find((test) => test.expected_outcome.type === 'refused')!;
    const guard = { ...base, status: 'blocked' as const, final_text: 'Safety guard: No refund was requested or issued.' };
    expect(scoreCase(test, guard)).toEqual([]);
    expect(scoreCase(test, { ...guard, status: 'failed' }).length).toBeGreaterThan(0);
  });
  it('stops repeated provider-wide quota/budget calls while preserving case-specific failures', () => {
    expect(evalBlockReason(providerFailure({ status: 429 }))).toContain('quota');
    expect(evalBlockReason(providerFailure({ status: 503 }))).toContain('unavailable');
    expect(evalBlockReason(new SafetyLimitError('Daily budget', 429))).toBe('Daily budget');
    expect(evalBlockReason(new Error('Bad case output'))).toBeNull();
  });
  it('keeps unknown costs out of the average and reports infrastructure coverage separately', () => {
    const report = { ...base, total_cases: 2 } as unknown as EvalReport;
    const result = { id: 'one', attempted: true, run_id: base.id, passed: true, infrastructure_error: null, failures: [], tools: [], outcome: 'ok', latency_ms: 100, estimated_cost_microusd: 10, allocated_cost_microusd: 30 };
    const summary = summarizeReport(report, [result, { ...result, id: 'two', passed: false, latency_ms: 300, infrastructure_error: 'Quota', estimated_cost_microusd: null }]);
    expect(summary).toMatchObject({ passed: 1, infrastructure_errors: 1, average_latency_ms: 200, average_cost_microusd: 10, cost_coverage: 1 });
  });
});
