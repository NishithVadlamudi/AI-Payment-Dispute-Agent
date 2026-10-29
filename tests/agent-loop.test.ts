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

describe('provider-independent native tool-use loop', () => {
  it('executes a tool and returns its result to the model before streaming the answer', async () => {
    const model = modelWith([
      [
        {
          type: 'completed',
          output: [
            call('search_transactions', {
              customer_id: customers[0].id,
              amount: 8499,
              date_range: null,
            }),
          ],
        },
      ],
      [
        { type: 'text', text: 'I found two matching charges.' },
        { type: 'completed', output: [] },
      ],
    ]);
    const events = await collect(model);
    expect(model.turn).toHaveBeenCalledTimes(2);
    const result = model.requests[1].input.find((item) => item.type === 'function_call_output');
    expect(
      result && 'output' in result && JSON.parse(String(result.output)).transactions,
    ).toHaveLength(2);
    expect(events).toContainEqual({ type: 'text_delta', text: 'I found two matching charges.' });
    expect(events.at(-1)).toEqual({ type: 'done', steps: 2, limited: false });
  });
  it('handles multiple calls in a turn and retains their call IDs', async () => {
    const model = modelWith([
      [
        {
          type: 'completed',
          output: [
            call('get_transaction', { transaction_id: transactions[0].id }, 'first'),
            call('get_transaction', { transaction_id: transactions[1].id }, 'second'),
          ],
        },
      ],
      [
        { type: 'text', text: 'Both succeeded.' },
        { type: 'completed', output: [] },
      ],
    ]);
    const events = await collect(model);
    expect(
      events.filter((event) => event.type === 'tool_finished').map((event) => event.callId),
    ).toEqual(['first', 'second']);
  });
  it('returns malformed tool arguments and tool failures to the model so it can recover', async () => {
    const model = modelWith([
      [{ type: 'completed', output: [call('get_transaction', '{broken json')] }],
      [
        {
          type: 'completed',
          output: [
            call(
              'search_transactions',
              { customer_id: customers[0].id, amount: null, date_range: null },
              'retry',
            ),
          ],
        },
      ],
      [
        { type: 'text', text: 'The database is unavailable.' },
        { type: 'completed', output: [] },
      ],
    ]);
    const store = fakeStore();
    vi.mocked(store.search).mockRejectedValue(new Error('unavailable'));
    const events = await collect(model, store);
    const failures = events.filter((event) => event.type === 'tool_finished');
    expect(failures).toHaveLength(2);
    expect(failures.every((event) => event.failed)).toBe(true);
    expect(
      model.requests[2].input.filter((item) => item.type === 'function_call_output'),
    ).toHaveLength(2);
  });
  it('caps an endlessly tool-calling model at eight turns', async () => {
    const model = modelWith([
      [{ type: 'completed', output: [call('get_refund_policy', { reason: 'duplicate_charge' })] }],
    ]);
    const events = await collect(model);
    expect(model.turn).toHaveBeenCalledTimes(MAX_STEPS);
    expect(events.at(-1)).toEqual({ type: 'done', steps: 8, limited: true });
    expect(events).toContainEqual({
      type: 'text_delta',
      text: expect.stringContaining('eight-step limit'),
    });
  });
  it('does not execute unknown money-moving tools', async () => {
    const model = modelWith([
      [{ type: 'completed', output: [call('approve_refund', { amount_cents: 500000 })] }],
      [
        { type: 'text', text: 'I cannot issue a refund.' },
        { type: 'completed', output: [] },
      ],
    ]);
    expect(await collect(model)).toContainEqual(
      expect.objectContaining({
        type: 'tool_finished',
        failed: true,
        result: { error: { code: 'UNKNOWN_TOOL', message: expect.any(String) } },
      }),
    );
  });
  it('requests human approval, returns the pending result to the model, and audits the call', async () => {
    const store = fakeStore();
    const refund = { ...refunds[0], transaction_id: transactions[0].id, status: 'pending_approval' as const };
    vi.mocked(store.requestRefund).mockResolvedValue(refund);
    const args = { transaction_id: transactions[0].id, amount_cents: 6500, reason: 'Suspected duplicate; two matching charges.' };
    const model = modelWith([
      [{ type: 'completed', output: [call('request_refund', args)] }],
      [{ type: 'text', text: 'A refund request is awaiting human approval.' }, { type: 'completed', output: [] }],
    ]);
    const events = await collect(model, store);
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool_finished', failed: false, result: { refund, requires_approval: true } }));
    const started = events.find((event) => event.type === 'run_started')!;
    expect(store.requestRefund).toHaveBeenCalledWith(customers[0].id, args, expect.any(String), started.type === 'run_started' ? started.runId : '');
    expect(store.audit).toHaveBeenCalledTimes(2);
    expect(model.requests[1].input).toContainEqual(expect.objectContaining({ type: 'function_call_output', output: JSON.stringify({ refund, requires_approval: true }) }));
  });
  it('fails closed before creating a refund if the audit log is unavailable', async () => {
    const store = fakeStore();
    vi.mocked(store.audit).mockRejectedValue(new Error('Audit unavailable'));
    const model = modelWith([[{ type: 'completed', output: [call('request_refund', { transaction_id: transactions[0].id, amount_cents: 100, reason: 'Review duplicate' })] }]]);
    await expect(collect(model, store)).rejects.toThrow('Audit unavailable');
    expect(store.requestRefund).not.toHaveBeenCalled();
  });
  it('reports an empty final response and rejects an interrupted provider stream', async () => {
    expect(await collect(modelWith([[{ type: 'completed', output: [] }]]))).toContainEqual(
      expect.objectContaining({ type: 'error' }),
    );
    await expect(collect(modelWith([[{ type: 'text', text: 'Partial' }]]))).rejects.toThrow(
      'did not complete',
    );
  });
  it.each(['₀', '   ', '...', '129.00'])('does not report a symbol-only or numeric answer as completed: %s', async (text) => {
    const events = await collect(modelWith([[{ type: 'text', text }, { type: 'completed', output: [] }]]));
    expect(events).toContainEqual(expect.objectContaining({ type: 'error', message: expect.stringContaining('incomplete') }));
    expect(events.some((event) => event.type === 'done')).toBe(false);
  });
  it('accepts an explanation written in a non-Latin script', async () => {
    const events = await collect(modelWith([[{ type: 'text', text: '返金は処理中です。' }, { type: 'completed', output: [] }]]));
    expect(events.at(-1)).toEqual({ type: 'done', steps: 1, limited: false });
  });
  it('recovers one unusable answer from existing evidence with tools disabled', async () => {
    const store = fakeStore();
    const model = modelWith([
      [{ type: 'completed', output: [call('get_transaction', { transaction_id: transactions[0].id })] }],
      [{ type: 'text', text: '₀' }, { type: 'completed', output: [] }],
      [{ type: 'text', text: 'The payment succeeded. No refund has been issued.' }, { type: 'completed', output: [] }],
    ]);
    const events = await collect(model, store);
    expect(model.turn).toHaveBeenCalledTimes(3);
    expect(model.requests[2].tools).toEqual([]);
    expect(model.requests[2].input).toContainEqual(expect.objectContaining({ role: 'user', content: expect.stringContaining('successful tool evidence') }));
    expect(events.filter((event) => event.type === 'text_delta').map((event) => event.type === 'text_delta' ? event.text : '').join('')).not.toContain('₀');
    expect(events.at(-1)).toEqual({ type: 'done', steps: 3, limited: false });
    expect(store.requestRefund).not.toHaveBeenCalled();
    expect(store.audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'answer_repair_started' }));
  });
  it('does not execute a tool returned during answer-only recovery', async () => {
    const store = fakeStore();
    const model = modelWith([
      [{ type: 'completed', output: [call('get_transaction', { transaction_id: transactions[0].id })] }],
      [{ type: 'text', text: '₀' }, { type: 'completed', output: [] }],
      [{ type: 'text', text: 'I requested a refund.' }, { type: 'completed', output: [call('request_refund', { transaction_id: transactions[0].id, amount_cents: 8499, reason: 'Duplicate' })] }],
    ]);
    const events = await collect(model, store);
    expect(store.requestRefund).not.toHaveBeenCalled();
    expect(events.some((event) => event.type === 'done')).toBe(false);
    expect(events.some((event) => event.type === 'text_delta' && event.text.includes('I requested'))).toBe(false);
  });
  it('stops after one unsuccessful repair without retrying until a pass', async () => {
    const model = modelWith([
      [{ type: 'completed', output: [call('get_transaction', { transaction_id: transactions[0].id })] }],
      [{ type: 'text', text: '₀' }, { type: 'completed', output: [] }],
      [{ type: 'text', text: '...' }, { type: 'completed', output: [] }],
    ]);
    const events = await collect(model);
    expect(model.turn).toHaveBeenCalledTimes(3);
    expect(events.at(-1)).toMatchObject({ type: 'error' });
    expect(events.some((event) => event.type === 'done')).toBe(false);
  });
  it('does not extend the eight-turn ceiling to repair an answer', async () => {
    const turns: ModelEvent[][] = Array.from({ length: MAX_STEPS - 1 }, (_, i) => [{ type: 'completed', output: [call('get_transaction', { transaction_id: transactions[0].id }, 'read_' + i)] }]);
    turns.push([{ type: 'text', text: '₀' }, { type: 'completed', output: [] }]);
    const model = modelWith(turns);
    const events = await collect(model);
    expect(model.turn).toHaveBeenCalledTimes(MAX_STEPS);
    expect(events.at(-1)).toMatchObject({ type: 'error' });
  });
  it('never repairs a provider exception by making another model call', async () => {
    const model = modelWith([[{ type: 'completed', output: [call('get_transaction', { transaction_id: transactions[0].id })] }]]);
    model.turn.mockImplementationOnce(async function* () { throw Object.assign(new Error('Unavailable'), { status: 503 }); });
    await expect(collect(model)).rejects.toThrow('Unavailable');
    expect(model.turn).toHaveBeenCalledTimes(1);
  });
  it('stops before a model call when the client has cancelled', async () => {
    const abort = new AbortController();
    abort.abort();
    const model = modelWith([[{ type: 'completed', output: [] }]]);
    await expect(collect(model, fakeStore(), abort.signal)).rejects.toThrow();
    expect(model.turn).not.toHaveBeenCalled();
  });
});
