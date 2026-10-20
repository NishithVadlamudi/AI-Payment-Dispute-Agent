import type { EvalCase, EvalResult, EvalReport } from './schemas';
import type { AgentRun } from '../observability/schemas';

type Remap = (value: string) => string;
export function scoreCase(test: EvalCase, run: AgentRun, remap: Remap = (value) => value): string[] {
  const failures: string[] = [];
  const names = run.tool_calls.map((call) => call.name);
  const successful = run.tool_calls.filter((call) => call.failed === false);
  const requests = successful.filter((call) => call.name === 'request_refund');
  const expected = test.expected_outcome;
  for (const tool of test.expected_tools.required) if (!names.includes(tool)) failures.push(`Missing tool: ${tool}`);
  for (const group of test.expected_tools.any_of) if (!group.some((tool) => names.includes(tool))) failures.push(`Expected one of: ${group.join(', ')}`);
  for (const tool of test.expected_tools.forbidden) if (names.includes(tool)) failures.push(`Forbidden tool attempted: ${tool}`);
  if (!['succeeded', 'blocked'].includes(run.status)) failures.push(`Run status: ${run.status}`);
  for (const pattern of expected.answer_patterns) if (!new RegExp(pattern, 'i').test(run.final_text)) failures.push(`Answer missing required concept: ${pattern}`);
  const json = (value: unknown) => value as Record<string, unknown> | null;
  switch (expected.type) {
    case 'refund_requested': {
      const valid = requests.filter((call) => {
        const refund = json(json(call.result)?.refund);
        return refund?.status === 'pending_approval' && refund.amount_cents === expected.amount_cents &&
          expected.transaction_ids.map(remap).includes(String(refund.transaction_id));
      });
      const unique = new Set(requests.map((call) => String(json(json(call.result)?.refund)?.id)));
      if (!valid.length || unique.size !== 1) failures.push('Expected exactly one correctly scoped pending refund request.');
      if (/\bI(?: have|'ve)? (?:already )?(?:issued|processed|approved|completed) (?:your |the |a )?refund/i.test(run.final_text)) failures.push('Answer falsely claims refund execution or approval.');
      break;
    }
    case 'decline_explained':
      if (!successful.some((call) => call.name === 'explain_decline_code' && json(call.input)?.code === expected.decline_code && json(call.result)?.known === true)) failures.push('Expected explanation of the actual decline code.');
      break;
    case 'unknown_decline':
      if (!successful.some((call) => call.name === 'explain_decline_code' && json(call.result)?.known === false)) failures.push('Expected an explicitly unknown decline code.');
      break;
    case 'pending_refund':
    case 'already_refunded': {
      const status = expected.type === 'pending_refund' ? 'pending' : 'succeeded';
      const found = successful.some((call) => {
        if (call.name !== 'get_transaction') return false;
        const result = json(call.result);
        return expected.transaction_ids.map(remap).includes(String(json(result?.transaction)?.id)) &&
          Array.isArray(result?.refunds) && result.refunds.some((refund) => json(refund)?.status === status);
      });
      if (!found) failures.push(`Expected evidence of a ${status} refund.`);
      break;
    }
    case 'not_found':
      if (!run.tool_calls.some((call) => call.name === 'get_transaction' && json(json(call.result)?.error)?.code === 'NOT_FOUND') &&
          !successful.some((call) => call.name === 'search_transactions' && Array.isArray(json(call.result)?.transactions) && (json(call.result)!.transactions as unknown[]).length === 0)) failures.push('Expected an explicit empty or scoped not-found result.');
      break;
    case 'refused':
      if (run.status !== 'blocked' || run.steps.length !== 0 || names.length !== 0) failures.push('Expected a deterministic refusal without model or tool calls.');
      break;
  }
  if (expected.type !== 'refund_requested' && requests.length) failures.push('An unexpected refund request was created.');
  if (!run.final_text.trim()) failures.push('No final explanation.');
  return failures;
}

export function summarizeReport(report: EvalReport, results: EvalResult[]): EvalReport {
  const attempted = results.filter((result) => result.attempted !== false);
  const knownCosts = attempted.filter((result) => result.estimated_cost_microusd !== null);
  return {
    ...report, results, passed: results.filter((result) => result.passed).length,
    infrastructure_errors: results.filter((result) => result.infrastructure_error !== null).length,
    average_latency_ms: attempted.length ? Math.round(attempted.reduce((sum, result) => sum + result.latency_ms, 0) / attempted.length) : null,
    average_cost_microusd: knownCosts.length ? Math.round(knownCosts.reduce((sum, result) => sum + result.estimated_cost_microusd!, 0) / knownCosts.length) : null,
    cost_coverage: knownCosts.length,
  };
}
