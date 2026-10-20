'use client';

import { SiteHeader } from '../ui/site-header';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { runSchema, type AgentRun } from '@/lib/observability/schemas';
import { evalReportSchema, type EvalReport } from '@/lib/evals/schemas';

const payloadSchema = z.object({ runs: z.array(runSchema), reports: z.array(evalReportSchema) });
const dollars = (value: number | null) => value === null ? 'Unknown' : `$${(value / 1_000_000).toFixed(6)}`;
const tokens = (value: number | null) => value === null ? 'Unknown' : value.toLocaleString();

export function RunDashboard() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [reports, setReports] = useState<EvalReport[]>([]);
  const [source, setSource] = useState('chat');
  const [runId, setRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/observability?source=${source}${runId ? `&run_id=${encodeURIComponent(runId)}` : ''}`, { cache: 'no-store', signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Run details could not be loaded.');
      const checked = payloadSchema.safeParse(data);
      if (!checked.success) throw new Error('The server returned incomplete run details. Refresh and try again.');
      if (!signal?.aborted) { setRuns(checked.data.runs); setReports(checked.data.reports); }
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : 'Run details could not be loaded.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [source, runId]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  return (
    <>
    <SiteHeader active="observability" />
    <main id="main-content" className="approvals-page observability-page">

      <section className="page-heading"><div><span className="eyebrow">OBSERVABLE BY DESIGN</span>
        <h1>Under the hood</h1><p>See what the agent did, what it cost, and how it was evaluated.</p></div>
        <button className="review-button" disabled={loading} onClick={() => void load()}>Refresh</button></section>
      <p className="review-intro">These are fictional payment investigations. Traces contain tool evidence and final answers, never private model reasoning. Cost estimates use configured allowance rates; reserved budget is shown separately and is not a bill.</p>
      {error && <p className="chat-error" role="alert">{error}</p>}
      {loading && <p role="status">Loading run details…</p>}
      {!loading && !error && <>
        <h2 className="trace-section-title">Latest live evaluations</h2>
        {!reports.length && <section className="approval-card"><h3>No evaluation score yet</h3><p>Run the live evaluation suite to publish measured results here. Unit tests are not presented as model accuracy.</p></section>}
        {reports.map((report, index) => <details className="approval-card eval-card" key={report.id} open={index === 0}>
          <summary><span className="eyebrow">LIVE · {report.status.toUpperCase()} {report.total_cases < report.dataset_size ? '· SAMPLE' : ''}</span>
            <h3>{report.status === 'running' ? `${report.results.length}/${report.total_cases} processed` : `${report.passed}/${report.total_cases} passed (${(100 * report.passed / report.total_cases).toFixed(1)}%)`}</h3>
            <p>{report.model} · {new Date(report.started_at).toLocaleString()} · {report.total_cases} selected from {report.dataset_size} cases</p></summary>
          {report.status === 'partial' && <p className="chat-error">This evaluation has infrastructure errors or unattempted cases. It is not a complete model quality score.</p>}
          <dl className="trace-metrics">
            <div><dt>Average latency / case</dt><dd>{report.average_latency_ms === null ? 'Unknown' : `${(report.average_latency_ms / 1000).toFixed(2)}s`}</dd></div>
            <div><dt>Average estimated cost</dt><dd>{dollars(report.average_cost_microusd)}</dd></div>
            <div><dt>Cost coverage</dt><dd>{report.cost_coverage}/{report.results.filter((result) => result.attempted).length} attempted cases</dd></div>
            <div><dt>Infrastructure errors</dt><dd>{report.infrastructure_errors}</dd></div>
          </dl>
          <p className="review-intro">Checks cover tools and observable outcomes, not a human judgment of answer quality. Averages include guard refusals and failed attempts; they are not successful-answer latency. Guard refusals cost zero; failed calls may have unknown cost. Suite hash: <code>{report.suite_sha256}</code></p>
          <div className="eval-results">{report.results.map((result) => <details key={result.id} className="eval-result">
            <summary>{result.passed ? 'PASS' : !result.attempted ? 'SKIPPED' : result.infrastructure_error ? 'INFRA ERROR' : 'FAIL'} · {result.id} · {result.latency_ms}ms</summary>
            <p>{result.outcome}</p><p>Tools: {result.tools.join(', ') || 'None'}</p>
            {result.infrastructure_error && <p>{result.infrastructure_error}</p>}
            {result.failures.map((failure, i) => <p key={i}>{failure}</p>)}
            {result.run_id && <p><a className="approval-link" href="#recent-runs" onClick={() => { setSource('all'); setRunId(result.run_id); }} aria-label={`Inspect run for ${result.id}`}>Inspect run →</a> <code>{result.run_id}</code></p>}
          </details>)}</div>
        </details>)}
        <div className="trace-heading"><h2 id="recent-runs" className="trace-section-title">{runId ? 'Selected run' : 'Recent runs'}</h2>
          <label>Show <select value={source} onChange={(event) => { setRunId(null); setSource(event.target.value); }}><option value="chat">Chat runs</option><option value="eval">Evaluation runs</option><option value="all">All runs</option></select></label></div>
        {runId && <button className="review-button" onClick={() => setRunId(null)}>Back to recent runs</button>}
        {!runs.length && <section className="approval-card"><h3>{runId ? 'This run is unavailable' : 'No runs recorded yet'}</h3><p>Start an investigation to record a trace. Earlier phases did not collect these traces.</p></section>}
        {runs.map((run) => <details className="approval-card run-card" key={run.id} open={runId === run.id || undefined}>
          <summary><span className="eyebrow">{run.source.toUpperCase()} · {run.status.toUpperCase()}</span>
            <h3>{run.customer_name}</h3><p>{run.model} · {new Date(run.started_at).toLocaleString()}</p></summary>
          <dl className="trace-metrics">
            <div><dt>Steps / tools</dt><dd>{run.steps.length} / {run.tool_calls.length}</dd></div>
            <div><dt>Total latency</dt><dd>{run.latency_ms === null ? 'In progress' : `${(run.latency_ms / 1000).toFixed(2)}s`}</dd></div>
            <div><dt>Input / output tokens</dt><dd>{tokens(run.input_tokens)} / {tokens(run.output_tokens)}</dd></div>
            <div><dt>Estimated cost</dt><dd>{dollars(run.estimated_cost_microusd)}</dd></div>
            <div><dt>Reserved allowance</dt><dd>{dollars(run.allocated_cost_microusd)}</dd></div>
          </dl>
          <p className="trace-meta">Run <code>{run.id}</code> · Prompt {run.prompt_version}. An old “running” entry may indicate an interrupted process.</p>
          {run.error_message && <p className="chat-error">{run.error_message}</p>}
          <div className="trace-steps">{run.steps.map((step) => <p key={step.step}>Step {step.step}: {step.status} · {step.latency_ms ?? '—'}ms · {tokens(step.input_tokens)} input / {tokens(step.output_tokens)} output tokens{step.resolved_model ? ` · ${step.resolved_model}` : ''}</p>)}</div>
          {run.tool_calls.map((call, index) => <details className="tool-call" key={`${call.call_id}-${index}`}>
            <summary><code>{call.name}</code><span>{call.failed === null ? 'Interrupted / running' : call.failed ? 'Failed' : 'Completed'} · {call.duration_ms ?? '—'}ms</span></summary>
            <div className="tool-payload"><h4>INPUT</h4><pre>{JSON.stringify(call.input, null, 2)}</pre><h4>RESULT</h4><pre>{JSON.stringify(call.result, null, 2)}</pre></div>
          </details>)}
          {run.final_text && <div className="review-reason"><h3>Final answer (up to 16,000 characters)</h3><p>{run.final_text}</p></div>}
        </details>)}
      </>}
    </main>
    </>
  );
}
