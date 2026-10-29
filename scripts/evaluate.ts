import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { datasetSchema, evaluationSubsetSchema, evalReportSchema, type EvalReport, type EvalResult } from '../src/lib/evals/schemas';
import { unfinishedCases } from '../src/lib/evals/continuation';
import { evalBlockReason } from '../src/lib/evals/limits';
import { scoreCase, summarizeReport } from '../src/lib/evals/score';
import { createEvalFixture } from '../src/lib/evals/fixtures';
import { createEvalStore } from '../src/lib/evals/store';
import { createDatabaseClient } from '../src/lib/db/client';
import { createStore } from '../src/lib/db/queries';
import { createModelClient } from '../src/lib/agent/client';
import { runAgent } from '../src/lib/agent/loop';
import { agentFailureMessage } from '../src/lib/agent/errors';
import { createTraceStore } from '../src/lib/observability/store';
import { startRun } from '../src/lib/observability/session';
import { createAbuseControls } from '../src/lib/security/controls';
import { GUARD_MODEL_LABEL, hasUnsafeOverride, injectionRefusal } from '../src/lib/security/injection';

const { values } = parseArgs({ options: { limit: { type: 'string' }, case: { type: 'string' }, 'remaining-from': { type: 'string' }, split: { type: 'string', default: 'dev' }, validate: { type: 'boolean' } } });
if (!['dev', 'holdout', 'regression', 'validation', 'release', 'qualification'].includes(values.split!)) throw new Error('Choose --split dev, --split holdout, --split regression, --split validation, --split release or --split qualification.');
const raw = await readFile(values.split === 'dev' ? 'evals/cases.json' : `evals/${values.split}.json`, 'utf8');
const allCases = (values.split === 'dev' ? datasetSchema : evaluationSubsetSchema).parse(JSON.parse(raw));
if (values.validate) {
  console.log(`Validated ${allCases.length} ${values.split} evaluation cases. No model accuracy was measured.`);
} else {
  const limit = values.limit === undefined ? allCases.length : Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > allCases.length) throw new Error('Choose a limit between 1 and the dataset size.');
  const provider = (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase();
  const modelName = provider === 'openai' ? process.env.OPENAI_MODEL || 'gpt-5-mini' : process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const suite = `payment-disputes-v2-${values.split}`;
  const hash = createHash('sha256').update(raw).digest('hex');
  let eligible = allCases;
  if (values['remaining-from']) {
    for (const path of values['remaining-from'].split(',')) {
      const previous = evalReportSchema.parse(JSON.parse(await readFile(path, 'utf8')));
      const unfinished = new Set(unfinishedCases(allCases, previous, { suite, hash, provider, model: modelName }).map((item) => item.id));
      eligible = eligible.filter((item) => unfinished.has(item.id));
      console.log(`Excluding completed outcomes from ${previous.id}. Previous scoring failures remain failures.`);
    }
    console.log('Freeze prompt/scorer/fixtures across batches; this report is a separate batch, not a merged accuracy claim.');
  }
  const cases = (values.case ? eligible.filter((item) => item.id === values.case) : eligible).slice(0, limit);
  if (!cases.length) throw new Error('No matching case.');
  const db = createDatabaseClient();
  const evalStore = createEvalStore(db);
  const store = createStore(db);
  const traceStore = createTraceStore(db);
  const controls = createAbuseControls(db);
  let report: EvalReport = {
    id: crypto.randomUUID(), suite_name: `payment-disputes-v2-${values.split}`, suite_sha256: createHash('sha256').update(raw).digest('hex'),
    mode: 'live', model: modelName, provider, status: 'running', dataset_size: allCases.length, total_cases: cases.length,
    passed: 0, infrastructure_errors: 0, average_latency_ms: null, average_cost_microusd: null, cost_coverage: 0,
    results: [], started_at: new Date().toISOString(), finished_at: null,
  };
  await evalStore.save(report);
  const results: EvalResult[] = [];
  await mkdir('evals/results', { recursive: true });
  let blockedModelReason: string | null = null;
  for (const test of cases) {
    const start = performance.now();
    let fixture: Awaited<ReturnType<typeof createEvalFixture>> | undefined;
    let session: Awaited<ReturnType<typeof startRun>> | undefined;
    let infrastructureError: string | null = null;
    let cleanupFailed = false;
    const skipped = !!blockedModelReason && !hasUnsafeOverride([{ role: 'user', content: test.message }]);
    try {
      if (skipped) throw new Error('MODEL_CASE_SKIPPED');
      fixture = await createEvalFixture(db, test, report.id);
      const guarded = hasUnsafeOverride([{ role: 'user', content: fixture.message }]);
      const rawModel = guarded ? null : createModelClient();
      session = await startRun({ customer: fixture.customer, model: guarded ? GUARD_MODEL_LABEL : rawModel!.model,
        provider: guarded ? 'guard' : provider, store: traceStore, source: 'eval', evalReportId: report.id });
      if (guarded) {
        await store.audit({ run_id: session.run.id, actor: 'system', action: 'injection_blocked', customer_id: fixture.customer.id,
          payload: { rule: 'explicit_instruction_override', model_called: false } });
        session.run.final_text = injectionRefusal;
        await session.finish('blocked');
      } else {
        const model = session.wrap(controls.protect(rawModel!, { onReservation: session.reservation }));
        const signal = AbortSignal.timeout(180000);
        for await (const event of session.observe(runAgent({ customer: fixture.customer,
          messages: [{ role: 'user', content: fixture.message }], store, model, signal, runId: session.run.id }), signal)) {
          if (event.type === 'error') break;
        }
      }
    } catch (error) {
      infrastructureError = skipped ? `Skipped after shared limit: ${blockedModelReason}` : agentFailureMessage(error);
      blockedModelReason ??= evalBlockReason(error);
      if (session && session.run.status === 'running') await session.finish('failed', error);
    } finally {
      try { await fixture?.cleanup(); } catch { cleanupFailed = true; infrastructureError = 'Fixture cleanup failed; evaluation stopped to preserve evidence.'; }
    }
    const failures = session ? scoreCase(test, session.run, fixture?.remap) : ['Run could not start.'];
    const result: EvalResult = {
      id: test.id, attempted: !skipped, run_id: session?.run.id ?? null, passed: !infrastructureError && failures.length === 0,
      infrastructure_error: infrastructureError, failures,
      tools: session?.run.tool_calls.map((call) => call.name) ?? [],
      outcome: skipped ? 'Skipped: provider or daily budget limit; no model call attempted.' : session ? `${session.run.status}: ${session.run.final_text.slice(0, 300)}` : 'No run',
      latency_ms: Math.round(performance.now() - start),
      estimated_cost_microusd: session?.run.estimated_cost_microusd ?? null,
      allocated_cost_microusd: session?.run.allocated_cost_microusd ?? 0,
    };
    results.push(result);
    report = summarizeReport(report, results);
    await evalStore.save(report);
    await writeFile(`evals/results/${report.id}.json`, JSON.stringify(report, null, 2) + '\n');
    console.log(`${results.length}/${cases.length} ${test.id}: ${result.passed ? 'PASS' : skipped ? 'SKIPPED' : infrastructureError ? 'INFRASTRUCTURE ERROR' : 'FAIL'} (${result.latency_ms}ms)`);
    if (cleanupFailed) break;
  }
  report = { ...report, status: report.infrastructure_errors || results.length !== cases.length ? 'partial' : 'completed', finished_at: new Date().toISOString() };
  await evalStore.save(report);
  await writeFile(`evals/results/${report.id}.json`, JSON.stringify(report, null, 2) + '\n');
  await writeFile('evals/results/latest.json', JSON.stringify(report, null, 2) + '\n');
  console.log(`Selected-suite end-to-end pass rate: ${report.passed}/${report.total_cases} (${(100 * report.passed / report.total_cases).toFixed(1)}%). Split: ${values.split}; ${report.total_cases}/${report.dataset_size} cases selected. Status: ${report.status}. This is not completed-model-case accuracy.`);
  console.log(`Average attempted-case latency: ${report.average_latency_ms}ms. Average estimated cost: ${report.average_cost_microusd === null ? 'unknown' : '$' + (report.average_cost_microusd / 1_000_000).toFixed(6)} (known for ${report.cost_coverage}/${results.filter((result) => result.attempted).length} attempted cases; configured allowance rates).`);
  console.log(`Infrastructure errors: ${report.infrastructure_errors}. Report: evals/results/${report.id}.json`);
  process.exitCode = report.passed === report.total_cases ? 0 : 1;
}
