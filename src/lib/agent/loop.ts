import 'server-only';
import type { ModelClient, ModelInput, ModelOutput } from './types';
import type { AgentEvent } from './events';
import type { DisputeStore } from '../db/queries';
import type { Customer } from '../db/schemas';
import type { ChatRequest } from '../validation/chat';
import { systemPrompt } from './prompt';
import { hasUnsafeOverride } from '../security/injection';
import { tools } from '../tools/definitions';
import { executeTool } from '../tools/execute';

export const MAX_STEPS = 8;

export async function* runAgent(options: {
  customer: Customer;
  messages: ChatRequest['messages'];
  store: DisputeStore;
  model: ModelClient;
  signal?: AbortSignal;
  runId?: string;
}): AsyncGenerator<AgentEvent> {
  const { customer, messages, store, model, signal } = options;
  const input: ModelInput[] = messages.map(({ role, content }) => ({ role, content }));
  const instructions = systemPrompt(customer);
  const allowRefundRequests = !hasUnsafeOverride(messages);
  const runId = options.runId ?? crypto.randomUUID();
  yield { type: 'run_started', runId, model: model.model };
  for (let step = 1; step <= MAX_STEPS; step++) {
    signal?.throwIfAborted();
    yield { type: 'step_started', step };
    let output: ModelOutput[] | undefined;
    let textReceived = false;
    for await (const event of model.turn({ instructions, input, tools, signal })) {
      if (event.type === 'text') {
        textReceived ||= event.text.length > 0;
        yield { type: 'text_delta', text: event.text };
      } else output = event.output;
    }
    if (!output) throw new Error('The model did not complete its response.');
    input.push(...output);
    const calls = output.filter((item) => item.type === 'function_call');
    if (!calls.length) {
      if (!textReceived)
        yield { type: 'error', message: 'The agent returned no explanation. Please try again.' };
      yield { type: 'done', steps: step, limited: false };
      return;
    }
    for (const call of calls) {
      signal?.throwIfAborted();
      let args: unknown;
      try {
        args = JSON.parse(call.arguments);
      } catch {
        args = null;
      }
      yield { type: 'tool_started', callId: call.call_id, name: call.name, input: args };
      const started = performance.now();
      const result = await executeTool(call.name, args, customer.id, store, { runId, callId: call.call_id, allowRefundRequests });
      yield {
        type: 'tool_finished',
        callId: call.call_id,
        result,
        failed: 'error' in result,
        durationMs: Math.round(performance.now() - started),
      };
      input.push({
        type: 'function_call_output',
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }
    if (step < MAX_STEPS && textReceived) yield { type: 'text_delta', text: '\n\n' };
  }
  yield {
    type: 'text_delta',
    text: '\n\nThe investigation reached its eight-step limit. No refund is issued without human approval. Check the approval queue for any requests already created before retrying.',
  };
  yield { type: 'done', steps: MAX_STEPS, limited: true };
}
