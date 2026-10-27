import { z } from 'zod';
import { toolNames } from '../tools/definitions';

const tool = z.enum(toolNames as [typeof toolNames[number], ...typeof toolNames[number][]]);
export const evalCaseSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/), customer_id: z.uuid(), message: z.string().min(1).max(4000),
  expected_tools: z.strictObject({ required: z.array(tool), any_of: z.array(z.array(tool).min(1)), forbidden: z.array(tool) }),
  expected_outcome: z.strictObject({
    type: z.enum(['refund_requested', 'decline_explained', 'pending_refund', 'already_refunded', 'no_refund', 'not_found', 'refused', 'request_blocked', 'unknown_decline']),
    transaction_ids: z.array(z.uuid()), amount_cents: z.number().int().positive().nullable(),
    decline_code: z.string().nullable(), answer_patterns: z.array(z.string().max(200)),
  }),
  fixture: z.strictObject({ merchant: z.string().nullable(), refund_reason: z.string().nullable() }),
});
export type EvalCase = z.infer<typeof evalCaseSchema>;
export const evaluationSubsetSchema = z.array(evalCaseSchema).min(1).max(50).superRefine((cases, ctx) => {
  if (new Set(cases.map((item) => item.id)).size !== cases.length) ctx.addIssue({ code: 'custom', message: 'Case IDs must be unique.' });
  for (const item of cases) for (const pattern of item.expected_outcome.answer_patterns) {
    try { new RegExp(pattern, 'i'); } catch { ctx.addIssue({ code: 'custom', message: `Invalid pattern in ${item.id}.` }); }
  }
});
export const datasetSchema = evaluationSubsetSchema.refine((cases) => cases.length >= 30, 'Development dataset requires at least 30 cases.');
export const evalResultSchema = z.object({
  id: z.string(), attempted: z.boolean().default(true), run_id: z.uuid().nullable(), passed: z.boolean(),
  infrastructure_error: z.string().nullable(), failures: z.array(z.string()),
  tools: z.array(z.string()), outcome: z.string(), latency_ms: z.number().int().nonnegative(),
  estimated_cost_microusd: z.number().int().nonnegative().nullable(),
  allocated_cost_microusd: z.number().int().nonnegative(),
});
export const evalReportSchema = z.object({
  id: z.uuid(), suite_name: z.string(), suite_sha256: z.string(), mode: z.literal('live'),
  model: z.string(), provider: z.string(), status: z.enum(['running', 'completed', 'partial', 'failed']),
  dataset_size: z.number().int(), total_cases: z.number().int(), passed: z.number().int(),
  infrastructure_errors: z.number().int(), average_latency_ms: z.number().int().nullable(),
  average_cost_microusd: z.number().int().nullable(), cost_coverage: z.number().int(),
  results: z.array(evalResultSchema), started_at: z.iso.datetime({ offset: true }),
  finished_at: z.iso.datetime({ offset: true }).nullable(),
});
export type EvalResult = z.infer<typeof evalResultSchema>;
export type EvalReport = z.infer<typeof evalReportSchema>;
