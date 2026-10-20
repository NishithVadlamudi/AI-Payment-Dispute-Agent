import { z } from 'zod';

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const usageSchema = z.object({ inputTokens: count, outputTokens: count });
export type ModelUsage = z.infer<typeof usageSchema>;
export const stepSchema = z.object({
  step: count,
  status: z.enum(['running', 'succeeded', 'failed', 'cancelled']),
  latency_ms: count.nullable(),
  input_tokens: count.nullable(),
  output_tokens: count.nullable(),
  estimated_cost_microusd: count.nullable(),
  allocated_cost_microusd: count,
  resolved_model: z.string().nullable(),
});
export const callSchema = z.object({
  call_id: z.string(), name: z.string(), input: z.json(),
  result: z.json().nullable(), failed: z.boolean().nullable(), duration_ms: count.nullable(),
});
export const runSchema = z.object({
  id: z.uuid(), customer_id: z.uuid().nullable(), customer_name: z.string(),
  source: z.enum(['chat', 'eval']), eval_report_id: z.uuid().nullable(),
  model: z.string(), provider: z.string(), prompt_version: z.string(),
  status: z.enum(['running', 'succeeded', 'limited', 'blocked', 'failed', 'cancelled']),
  steps: z.array(stepSchema), tool_calls: z.array(callSchema),
  input_tokens: count.nullable(), output_tokens: count.nullable(),
  estimated_cost_microusd: count.nullable(), allocated_cost_microusd: count,
  latency_ms: count.nullable(), final_text: z.string(), error_message: z.string().nullable(),
  started_at: z.iso.datetime({ offset: true }), finished_at: z.iso.datetime({ offset: true }).nullable(),
});
export type AgentRun = z.infer<typeof runSchema>;
export type RunStep = z.infer<typeof stepSchema>;
