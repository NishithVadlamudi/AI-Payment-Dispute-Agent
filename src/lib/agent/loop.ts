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
import { renderEvidenceAnswer, INCOMPLETE_ANSWER, SCOPED_MISS, type AnswerEvidence } from './evidence-answer';

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
  const evidence: AnswerEvidence[] = [];
  let requestedDetailRecovery = false;
  yield { type: 'run_started', runId, model: model.model };
  for (let step = 1; step <= MAX_STEPS; step++) {
    signal?.throwIfAborted();
    yield { type: 'step_started', step };
    let output: ModelOutput[] | undefined;
    for await (const event of model.turn({ instructions, input, tools, signal })) {
      // Native context stays server-side for tool planning. No model prose is
      // forwarded to the customer, even when it appears to be a final answer.
      if (event.type === 'completed') output = event.output;
    }
    if (!output) throw new Error('The model did not complete its response.');
    input.push(...output);
    const calls = output.filter(item => item.type === 'function_call');
    if (!calls.length) {
      const answer = renderEvidenceAnswer(customer.id, evidence);
      // One bounded planning continuation for discovery-only results, not a
      // prose rewrite or an automatic retry of a failed provider request.
      if (!answer.complete && !requestedDetailRecovery && step < MAX_STEPS &&
          evidence.some(e => e.name === 'search_transactions' && !('error' in (e.result as object))) &&
          !evidence.some(e => e.name === 'get_transaction')) {
        requestedDetailRecovery = true;
        input.push({ role: 'user', content: 'The application cannot finish from search candidates alone. Use get_transaction for only the payment IDs relevant to the original user request, retrieving their refund histories. Do not expand to unrelated search candidates or create any refund merely to complete evidence. Then retrieve any required decline reference or refund policy. If the target is ambiguous, leave the investigation incomplete.' });
        continue;
      }
      await store.audit({ run_id: runId, actor: 'system', customer_id: customer.id,
        action: 'evidence_answer_rendered', payload: { complete: answer.complete, evidence_count: evidence.length, step } });
      if (answer.text !== INCOMPLETE_ANSWER) yield { type: 'text_delta', text: answer.text };
      if (!answer.complete) { yield { type: 'error', message: INCOMPLETE_ANSWER }; return; }
      yield { type: 'done', steps: step, limited: false };
      return;
    }
    let onlyScopedMisses = true;
    for (const call of calls) {
      signal?.throwIfAborted();
      let args: unknown;
      try { args = JSON.parse(call.arguments); } catch { args = null; }
      yield { type: 'tool_started', callId: call.call_id, name: call.name, input: args };
      const started = performance.now();
      const result = await executeTool(call.name, args, customer.id, store, { runId, callId: call.call_id, allowRefundRequests });
      evidence.push({ name: call.name, input: args, result });
      onlyScopedMisses &&= call.name === 'get_transaction' && 'error' in result && result.error.code === 'NOT_FOUND';
      yield { type: 'tool_finished', callId: call.call_id, result, failed: 'error' in result,
        durationMs: Math.round(performance.now() - started) };
      input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
    }
    if (onlyScopedMisses && renderEvidenceAnswer(customer.id, evidence).text === SCOPED_MISS) {
      yield { type: 'text_delta', text: SCOPED_MISS };
      yield { type: 'done', steps: step, limited: false };
      return;
    }
  }
  const answer = renderEvidenceAnswer(customer.id, evidence);
  if (answer.text !== INCOMPLETE_ANSWER) yield { type: 'text_delta', text: answer.text };
  yield { type: 'text_delta', text: '\n\nThe investigation reached its eight-step limit and is incomplete. No refund is issued without human approval. Review the recorded tool activity for requests already created.' };
  yield { type: 'done', steps: MAX_STEPS, limited: true };
}
