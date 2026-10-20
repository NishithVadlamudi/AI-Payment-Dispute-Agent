import 'server-only';
import { createHash } from 'node:crypto';
import { RefundError } from '../db/refunds';
import type { DisputeStore } from '../db/queries';
import { explainDecline } from './decline-codes';
import { toolSchemas, toolErrorSchema } from './definitions';
import type { ToolError, ToolName, ToolResult } from './definitions';

type ToolContext = { runId: string; callId: string; allowRefundRequests?: boolean };

const failure = (code: ToolError['error']['code'], message: string): ToolError =>
  toolErrorSchema.parse({ error: { code, message } });

async function dispatchTool(
  name: string,
  input: unknown,
  customerId: string,
  store: DisputeStore,
  context: ToolContext,
): Promise<ToolResult> {
  if (!Object.hasOwn(toolSchemas, name))
    return failure(
      'UNKNOWN_TOOL',
      'That tool is unavailable. Only the documented investigation and refund-request tools are supported.',
    );
  const definition = toolSchemas[name as ToolName];
  const parsed = definition.input.safeParse(input);
  if (!parsed.success)
    return failure(
      'INVALID_INPUT',
      'Tool arguments do not match the schema. Supply required fields; amounts must be positive integer cents. Use null for optional search filters.',
    );
  try {
    let result: unknown;
    switch (name) {
      case 'request_refund': {
        if (context.allowRefundRequests === false)
          return failure('UNSAFE_REQUEST', 'Refund requests are disabled for this unsafe instruction attempt. Human approval cannot be bypassed.');
        const args = toolSchemas.request_refund.input.parse(input);
        const key = createHash('sha256')
          .update(`${context.runId}:${context.callId}`)
          .digest('hex');
        const refund = toolSchemas.request_refund.output.shape.refund.parse(
          await store.requestRefund(customerId, args, key, context.runId),
        );
        if (refund.transaction_id !== args.transaction_id) throw new Error('Scope mismatch');
        result = { refund, requires_approval: true };
        break;
      }
      case 'search_transactions': {
        const args = toolSchemas.search_transactions.input.parse(input);
        if (args.customer_id !== customerId)
          return failure(
            'CUSTOMER_MISMATCH',
            'Only the selected customer can be investigated. Use the customer ID from the system instructions.',
          );
        if (args.date_range && Date.parse(args.date_range.start) > Date.parse(args.date_range.end))
          return failure('INVALID_INPUT', 'The date range start must precede or equal its end.');
        result = await store.search(customerId, {
          amount: args.amount ?? undefined,
          date_range: args.date_range ?? undefined,
        });
        const checked = toolSchemas.search_transactions.output.parse(result);
        if (checked.transactions.some((transaction) => transaction.customer_id !== customerId))
          throw new Error('Scope mismatch');
        return checked;
      }
      case 'get_transaction': {
        const args = toolSchemas.get_transaction.input.parse(input);
        result = await store.transaction(customerId, args.transaction_id);
        if (!result)
          return failure('NOT_FOUND', 'No matching transaction exists for the selected customer.');
        const checked = toolSchemas.get_transaction.output.parse(result);
        if (
          checked.transaction.customer_id !== customerId ||
          checked.refunds.some((refund) => refund.transaction_id !== checked.transaction.id)
        )
          throw new Error('Scope mismatch');
        return checked;
      }
      case 'explain_decline_code':
        result = explainDecline(toolSchemas.explain_decline_code.input.parse(input).code);
        break;
      case 'get_refund_policy':
        result = await store.policy(toolSchemas.get_refund_policy.input.parse(input).reason);
        if (!result)
          return failure('NOT_FOUND', 'That refund policy is unavailable in the demo database.');
        break;
    }
    return definition.output.parse(result);
  } catch (error) {
    if (error instanceof RefundError) return failure('REFUND_BLOCKED', error.message);
    return failure(
      'TOOL_FAILED',
      'The tool could not read or validate the demo data. Try another appropriate tool, or explain that the investigation is incomplete.',
    );
  }
}

// Audit the attempt before executing a tool, so even interrupted calls remain visible.
export async function executeTool(
  name: string,
  input: unknown,
  customerId: string,
  store: DisputeStore,
  context: ToolContext = {
    runId: crypto.randomUUID(),
    callId: crypto.randomUUID(),
  },
): Promise<ToolResult> {
  const base = { run_id: context.runId, actor: 'agent' as const, customer_id: customerId };
  await store.audit({
    ...base,
    action: 'tool_started',
    payload: { name, call_id: context.callId, input },
  });
  const result = await dispatchTool(name, input, customerId, store, context);
  await store.audit({
    ...base,
    action: 'tool_finished',
    payload: { name, call_id: context.callId, result, failed: 'error' in result },
  });
  return result;
}
