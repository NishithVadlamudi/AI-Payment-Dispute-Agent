import { afterAll, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createTraceStore, recentRuns } from '../src/lib/observability/store';
import { startRun } from '../src/lib/observability/session';
import { createEvalStore } from '../src/lib/evals/store';
import { createEvalFixture } from '../src/lib/evals/fixtures';
import { datasetSchema, type EvalReport } from '../src/lib/evals/schemas';
import { readFileSync } from 'node:fs';
import { createStore } from '../src/lib/db/queries';
import { executeTool } from '../src/lib/tools/execute';
import { demoId } from '../src/lib/demo/seed-data';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const cases = datasetSchema.parse(JSON.parse(readFileSync('evals/cases.json', 'utf8')));
const report: EvalReport = { id: crypto.randomUUID(), suite_name: 'integration-only', suite_sha256: 'integration', mode: 'live', model: 'mock-no-provider-call', provider: 'test', status: 'running',
  dataset_size: 40, total_cases: 1, passed: 0, infrastructure_errors: 0, average_latency_ms: null, average_cost_microusd: null, cost_coverage: 0, results: [], started_at: new Date().toISOString(), finished_at: null };
const runIds: string[] = [];
afterAll(async () => {
  if (runIds.length) {
    await db.from('audit_log').delete().in('run_id', runIds);
    await db.from('agent_runs').delete().in('id', runIds);
  }
  await db.from('eval_reports').delete().eq('id', report.id);
});
describe('persistent traces and isolated eval fixtures', () => {
  it('persists a 16-case holdout report while rejecting empty or oversized datasets',async()=>{
    await createEvalStore(db).save({...report,dataset_size:16,total_cases:16});
    const independent=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
    const saved=await independent.from('eval_reports').select('dataset_size,total_cases').eq('id',report.id).single();
    expect(saved.error).toBeNull();expect(saved.data).toEqual({dataset_size:16,total_cases:16});
    for(const dataset_size of [0,51])expect((await db.from('eval_reports').update({dataset_size}).eq('id',report.id)).error?.code).toBe('23514');
  });
  it('persists run data and retains trace/audit history when fixture customers are removed', async () => {
    await createEvalStore(db).save(report);
    const fixture = await createEvalFixture(db, cases[0], report.id);
    const session = await startRun({ customer: fixture.customer, model: 'mock-no-provider-call', provider: 'test', source: 'eval', evalReportId: report.id, store: createTraceStore(db) });
    runIds.push(session.run.id);
    try {
      const result = await executeTool('get_transaction', { transaction_id: fixture.remap(demoId(1000)) }, fixture.customer.id, createStore(db), { runId: session.run.id, callId: 'read' });
      expect(result).toMatchObject({ transaction: { customer_id: fixture.customer.id } });
      session.run.final_text = 'Integration fixture only; no AI request.';
      await session.finish('succeeded');
    } finally { await fixture.cleanup(); }
    const { data, error } = await db.from('agent_runs').select('*').eq('id', session.run.id).single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ customer_id: null, customer_name: fixture.customer.name, source: 'eval', status: 'succeeded' });
    expect((await db.from('audit_log').select('customer_id').eq('run_id', session.run.id)).data).toEqual([{ customer_id: null }, { customer_id: null }]);
    expect((await db.from('transactions').select('id').eq('id', fixture.remap(demoId(1000)))).data).toEqual([]);
  });
  it('filters recent trace sources and preserves real seed data', async () => {
    expect((await recentRuns(db, 'eval')).every((run) => run.source === 'eval')).toBe(true);
    const original = await createStore(db).transaction(demoId(1), demoId(1000));
    expect(original?.transaction).toMatchObject({ amount_cents: 8499, merchant: 'Northstar Electronics' });
  });
  it('denies anonymous trace/eval table reads through RLS', async () => {
    const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    for (const table of ['agent_runs', 'eval_reports']) {
      const { data, error } = await anon.from(table).select('*');
      expect(error !== null || data?.length === 0).toBe(true);
    }
  });
});
