import { z } from 'zod';
import type { AgentTool } from '../agent/types';
import { cents, transactionSchema, refundSchema, policySchema } from '../db/schemas';

const dateRange = z.strictObject({
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
});
export const toolSchemas = {
  request_refund: {
    description:
      'Request a mock refund for a succeeded transaction in the selected account. Creates pending_approval only; never issues money. Inspect the transaction, existing refunds and policy first. amount_cents is a positive integer within the unrefunded balance. reason must explain the evidence for the human reviewer, not private thoughts. Existing pending requests are returned without duplication. Human approval is required in the approval queue.',
    input: z.strictObject({ transaction_id: z.uuid(), amount_cents: cents, reason: z.string().trim().min(3).max(2000) }),
    output: z.object({ refund: refundSchema, requires_approval: z.literal(true) }),
  },
  search_transactions: {
    description:
      'Find transactions for the selected demo customer, newest first (maximum 50). amount is an exact integer number of cents, or null for any amount. date_range uses inclusive ISO timestamps, or null for all dates. Matching charges are evidence, not proof, of duplication.',
    input: z.strictObject({
      customer_id: z.uuid(),
      amount: cents.nullable(),
      date_range: dateRange.nullable(),
    }),
    output: z.object({ transactions: z.array(transactionSchema), truncated: z.boolean() }),
  },
  get_transaction: {
    description:
      'Retrieve one transaction and all its refund records within the selected customer’s account. Always check existing refunds before recommending a next step. This tool cannot issue a refund.',
    input: z.strictObject({ transaction_id: z.uuid() }),
    output: z.object({ transaction: transactionSchema, refunds: z.array(refundSchema) }),
  },
  explain_decline_code: {
    description:
      'Explain a payment decline code and a safe next step using the demo reference. Unknown codes are reported explicitly; do not invent a bank explanation.',
    input: z.strictObject({ code: z.string().min(1).max(100) }),
    output: z.object({
      code: z.string(),
      known: z.boolean(),
      meaning: z.string(),
      suggested_action: z.string(),
    }),
  },
  get_refund_policy: {
    description:
      'Look up the demo refund policy for duplicate_charge, missing_refund, declined_payment, or other. Policies describe eligibility and timing; a policy is not an approval and this tool does not change money.',
    input: z.strictObject({
      reason: z.enum(['duplicate_charge', 'missing_refund', 'declined_payment', 'other']),
    }),
    output: policySchema,
  },
} as const;

export type ToolName = keyof typeof toolSchemas;
export const toolNames = Object.keys(toolSchemas) as ToolName[];
export const tools: AgentTool[] = toolNames.map((name) => {
  const { $schema, ...parameters } = z.toJSONSchema(toolSchemas[name].input);
  void $schema;
  return {
    type: 'function',
    name,
    description: toolSchemas[name].description,
    parameters,
    strict: true,
  };
});

export const toolErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      'UNKNOWN_TOOL',
      'INVALID_INPUT',
      'CUSTOMER_MISMATCH',
      'NOT_FOUND',
      'TOOL_FAILED',
      'REFUND_BLOCKED',
      'UNSAFE_REQUEST',
    ]),
    message: z.string(),
  }),
});
export type ToolError = z.infer<typeof toolErrorSchema>;
export type ToolResult = z.infer<(typeof toolSchemas)[ToolName]['output']> | ToolError;
