import type { EvalCase, EvalReport } from './schemas';

// Continue missing/infrastructure cases only. Completed scoring failures are
// evidence, not invitations to retry until they pass.
export function unfinishedCases(cases: EvalCase[], report: EvalReport,
  expected: { suite: string; hash: string; provider: string; model: string }) {
  if (report.suite_name !== expected.suite || report.suite_sha256 !== expected.hash ||
      report.provider !== expected.provider || report.model !== expected.model || report.dataset_size !== cases.length)
    throw new Error('Continuation requires the same dataset, split, provider and model.');
  const ids = new Set(cases.map((item) => item.id));
  if (new Set(report.results.map((item) => item.id)).size !== report.results.length || report.results.some((item) => !ids.has(item.id)))
    throw new Error('Continuation report contains duplicate or unknown case IDs.');
  const completed = new Set(report.results.filter((item) => item.attempted && !item.infrastructure_error).map((item) => item.id));
  return cases.filter((item) => !completed.has(item.id));
}
