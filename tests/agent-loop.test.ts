import { describe, expect, it, vi } from 'vitest';
import { runAgent, MAX_STEPS } from '../src/lib/agent/loop';
import type { ModelClient, ModelEvent, ModelOutput, ModelRequest } from '../src/lib/agent/client';
import type { AgentEvent } from '../src/lib/agent/events';
import { fakeStore, customers, transactions, refunds } from './helpers';

function call(name: string, args: unknown, id = 'call_1'): ModelOutput {
  return {
    type: 'function_call',
    name,
    arguments: typeof args === 'string' ? args : JSON.stringify(args),
    call_id: id,
  };
}
function modelWith(turns: ModelEvent[][]) {
  const requests: ModelRequest[] = [];
  const turn = vi.fn(async function* (request: ModelRequest) {
    requests.push(structuredClone({ ...request, signal: undefined }));
    for (const event of turns[Math.min(requests.length - 1, turns.length - 1)]) yield event;
  });
  return { model: 'mock-provider', turn, requests };
}
async function collect(model: ModelClient, store = fakeStore(), signal?: AbortSignal) {
  const events: AgentEvent[] = [];
  for await (const event of runAgent({
    customer: customers[0],
    messages: [{ role: 'user', content: 'I was charged twice.' }],
    model,
    store,
    signal,
  }))
    events.push(event);
  return events;
}

describe('provider-independent tool planning with evidence-only answers', () => {
  it('returns native tool results to the planner and renders actual evidence', async () => {
    const model = modelWith([
      [{ type: 'completed', output: [call('get_transaction', { transaction_id: transactions[0].id })] }],
      [{ type: 'text', text: 'MODEL_ONLY_TEXT' }, { type: 'completed', output: [] }],
    ]);
    const events = await collect(model);
    expect(model.requests[1].input).toContainEqual(expect.objectContaining({ type: 'function_call_output' }));
    const text = events.filter(e => e.type === 'text_delta').map(e => e.type === 'text_delta' ? e.text : '').join('');
    expect(text).toContain('Northstar Electronics');
    expect(text).toContain('$84.99');
    expect(text).not.toContain('MODEL_ONLY_TEXT');
    expect(events.at(-1)).toEqual({ type: 'done', steps: 2, limited: false });
  });
  it.each(['₀', '', '_gen_answer\nI should analyze the user request.', 'op\nLet us inspect the tool description.', 'I have approved your refund.', '$84.99 (8499 cents)', '返金は処理中です。'])('never releases arbitrary final model prose or retries it: %s', async text => {
    const model = modelWith([
      [{ type: 'text', text: 'TOOL_TURN_PRIVATE' }, { type: 'completed', output: [call('get_transaction', { transaction_id: transactions[0].id })] }],
      [{ type: 'text', text }, { type: 'completed', output: [] }],
    ]);
    const events = await collect(model);
    const answer = events.filter(e => e.type === 'text_delta').map(e => e.type === 'text_delta' ? e.text : '').join('');
    expect(answer).toContain('$84.99');
    expect(answer).not.toContain('TOOL_TURN_PRIVATE');
    for (const fragment of ['_gen_answer', 'I should analyze', 'Let us inspect', 'I have approved', '8499 cents', '返金は処理中']) expect(answer).not.toContain(fragment);
    expect(model.turn).toHaveBeenCalledTimes(2);
    expect(events.at(-1)?.type).toBe('done');
  });
  it('requires actual tool evidence even for fluent or non-Latin model text', async () => {
    const events = await collect(modelWith([[{ type: 'text', text: 'Your refund was approved.' }, { type: 'completed', output: [] }]]));
    expect(events.some(e => e.type === 'done')).toBe(false);
    expect(events.some(e => e.type === 'text_delta')).toBe(false);
    expect(events.at(-1)).toMatchObject({ type: 'error', message: expect.stringContaining('incomplete') });
  });
  it('preserves multiple call IDs and compares both actual records', async () => {
    const model = modelWith([
      [{ type: 'completed', output: [call('get_transaction', { transaction_id: transactions[0].id }, 'first'), call('get_transaction', { transaction_id: transactions[1].id }, 'second')] }],
      [{ type: 'completed', output: [] }],
    ]);
    const events = await collect(model);
    expect(events.filter(e => e.type === 'tool_finished').map(e => e.callId)).toEqual(['first', 'second']);
    expect(events).toContainEqual({ type: 'text_delta', text: expect.stringContaining('not proof of a duplicate') });
  });
  it('passes failed tool results back to the planner without inventing success', async () => {
    const model = modelWith([
      [{ type: 'completed', output: [call('get_transaction', '{broken json')] }],
      [{ type: 'completed', output: [call('search_transactions', { customer_id: customers[0].id, amount: null, date_range: null }, 'retry')] }],
      [{ type: 'text', text: 'All verified.' }, { type: 'completed', output: [] }],
    ]);
    const store = fakeStore(); vi.mocked(store.search).mockRejectedValue(new Error('Unavailable'));
    const events = await collect(model, store);
    expect(events.filter(e => e.type === 'tool_finished').every(e => e.failed)).toBe(true);
    expect(model.requests[2].input.filter(i => i.type === 'function_call_output')).toHaveLength(2);
    expect(events.at(-1)?.type).toBe('error');
  });
  it('caps an endlessly tool-calling planner at eight turns', async () => {
    const model = modelWith([[{ type: 'completed', output: [call('get_refund_policy', { reason: 'duplicate_charge' })] }]]);
    const events = await collect(model);
    expect(model.turn).toHaveBeenCalledTimes(MAX_STEPS);
    expect(events.at(-1)).toEqual({ type: 'done', steps: MAX_STEPS, limited: true });
    expect(events).toContainEqual({ type: 'text_delta', text: expect.stringContaining('eight-step limit') });
  });
  it('does not execute unknown approval or money-moving tools', async () => {
    const store = fakeStore();
    const model = modelWith([
      [{ type: 'completed', output: [call('approve_refund', { amount_cents: 500000 })] }],
      [{ type: 'text', text: 'Approved!' }, { type: 'completed', output: [] }],
    ]);
    const events = await collect(model, store);
    expect(store.requestRefund).not.toHaveBeenCalled();
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool_finished', failed: true, result: { error: { code: 'UNKNOWN_TOOL', message: expect.any(String) } } }));
    expect(events.some(e => e.type === 'done')).toBe(false);
  });
  it('renders only the returned human-approval request and preserves idempotency context', async () => {
    const store = fakeStore();
    const refund = { ...refunds[0], transaction_id: transactions[0].id, status: 'pending_approval' as const };
    vi.mocked(store.requestRefund).mockResolvedValue(refund);
    const args = { transaction_id: transactions[0].id, amount_cents: 6500, reason: 'Customer return' };
    const model = modelWith([
      [{ type: 'completed', output: [call('get_transaction', { transaction_id: transactions[0].id }, 'read'), call('get_refund_policy', { reason: 'other' }, 'policy'), call('request_refund', args, 'request')] }],
      [{ type: 'text', text: 'I have already issued the refund.' }, { type: 'completed', output: [] }],
    ]);
    const events = await collect(model, store);
    expect(store.requestRefund).toHaveBeenCalledWith(customers[0].id, args, expect.any(String), expect.any(String));
    expect(events).toContainEqual({ type: 'text_delta', text: expect.stringContaining('Awaiting a human decision; it has not been issued') });
    expect(model.requests[1].input).toContainEqual(expect.objectContaining({ type: 'function_call_output', output: JSON.stringify({ refund, requires_approval: true }) }));
    expect(store.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'evidence_answer_rendered' }));
    expect(store.requestRefund).toHaveBeenCalledTimes(1);
  });
  it('fails closed before executing a tool when audit is unavailable', async () => {
    const store = fakeStore(); vi.mocked(store.audit).mockRejectedValue(new Error('Audit unavailable'));
    const model = modelWith([[{ type: 'completed', output: [call('request_refund', { transaction_id: transactions[0].id, amount_cents: 100, reason: 'Return' })] }]]);
    await expect(collect(model, store)).rejects.toThrow('Audit unavailable');
    expect(store.requestRefund).not.toHaveBeenCalled();
  });
  it('does not expose partial provider text from an interrupted stream', async () => {
    const events: AgentEvent[] = [];
    const model = modelWith([[{ type: 'text', text: 'PRIVATE_PARTIAL' }]]);
    await expect((async () => { for await (const e of runAgent({ customer: customers[0], messages: [{ role: 'user', content: 'Check payment' }], store: fakeStore(), model })) events.push(e); })()).rejects.toThrow('did not complete');
    expect(events.some(e => e.type === 'text_delta')).toBe(false);
  });
  it('propagates provider failure without another call or a fabricated explanation', async () => {
    const model = modelWith([]);
    model.turn.mockImplementation(async function* () { throw Object.assign(new Error('Unavailable'), { status: 503 }); });
    await expect(collect(model)).rejects.toThrow('Unavailable');
    expect(model.turn).toHaveBeenCalledTimes(1);
  });
  it('returns scoped missing evidence without another model call', async () => {
    const store = fakeStore(); vi.mocked(store.transaction).mockResolvedValue(null);
    const model = modelWith([[{ type: 'completed', output: [call('get_transaction', { transaction_id: transactions[0].id })] }]]);
    const events = await collect(model, store);
    expect(model.turn).toHaveBeenCalledTimes(1);
    expect(events).toContainEqual({ type: 'text_delta', text: expect.stringContaining('does not establish whether') });
    expect(events.at(-1)).toEqual({ type: 'done', steps: 1, limited: false });
  });
  it('retains successful evidence alongside a scoped miss', async () => {
    const store = fakeStore(); vi.mocked(store.transaction).mockResolvedValueOnce(null);
    const model = modelWith([
      [{ type: 'completed', output: [call('get_transaction', { transaction_id: transactions[0].id }, 'missing'), call('get_transaction', { transaction_id: transactions[1].id }, 'found')] }],
      [{ type: 'completed', output: [] }],
    ]);
    const events = await collect(model, store);
    expect(events).toContainEqual({ type: 'text_delta', text: expect.stringContaining('$84.99') });
    expect(events.at(-1)).toEqual({ type: 'done', steps: 2, limited: false });
  });
  it('respects cancellation before any model call', async () => {
    const signal = AbortSignal.abort();
    const model = modelWith([]);
    await expect(collect(model, fakeStore(), signal)).rejects.toThrow();
    expect(model.turn).not.toHaveBeenCalled();
  });
  it('continues discovery-only evidence once to retrieve the selected payment without refund side effects', async () => {
    const model = modelWith([
      [{ type: 'completed', output: [call('search_transactions', { customer_id: customers[0].id, amount: null, date_range: null })] }],
      [{ type: 'completed', output: [] }],
      [{ type: 'completed', output: [call('get_transaction', { transaction_id: transactions[0].id }, 'detail')] }],
      [{ type: 'completed', output: [] }],
    ]);
    const store = fakeStore();
    const events = await collect(model, store);
    expect(model.requests[2].input).toContainEqual(expect.objectContaining({ role: 'user', content: expect.stringContaining('only the payment IDs relevant') }));
    expect(events.at(-1)).toEqual({ type: 'done', steps: 4, limited: false });
    expect(events.filter(e => e.type === 'tool_started').map(e => e.name)).toEqual(['search_transactions', 'get_transaction']);
  });
  it('stops after one discovery continuation if the planner still provides no detail', async () => {
    const model = modelWith([
      [{ type: 'completed', output: [call('search_transactions', { customer_id: customers[0].id, amount: null, date_range: null })] }],
      [{ type: 'completed', output: [] }],
    ]);
    const events = await collect(model);
    expect(model.turn).toHaveBeenCalledTimes(3);
    expect(events.at(-1)?.type).toBe('error');
  });

});
