import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentRun } from '../src/lib/observability/schemas';
import type { TraceStore } from '../src/lib/observability/store';
import { startRun } from '../src/lib/observability/session';
import { createAbuseControls, SafetyLimitError } from '../src/lib/security/controls';
import { customers } from './helpers';
import type { ModelClient } from '../src/lib/agent/types';
import { ModelProviderError } from '../src/lib/agent/errors';

beforeEach(() => { vi.stubEnv('AI_INPUT_MICROUSD_PER_TOKEN', '5'); vi.stubEnv('AI_OUTPUT_MICROUSD_PER_TOKEN', '20'); });
afterEach(() => vi.unstubAllEnvs());

function storeFixture() {
  const writes: AgentRun[] = [];
  const store: TraceStore = { start: vi.fn(async (run) => { writes.push(structuredClone(run)); }), save: vi.fn(async (run) => { writes.push(structuredClone(run)); }) };
  return { store, writes };
}
const modelRequest = { instructions: 'Fictional data only.', input: [], tools: [] };

describe('persistent observable run sessions', () => {
  it('stores token counts and tool evidence without provider context or private thoughts', async () => {
    const { store, writes } = storeFixture();
    const session = await startRun({ customer: customers[0], model: 'test', provider: 'gemini', store });
    const model: ModelClient = { model: 'test', async *turn() {
      yield { type: 'completed', output: [{ type: 'provider_context', provider: 'gemini', content: { parts: [{ text: 'PRIVATE THOUGHT', thought: true, thoughtSignature: 'PRIVATE SIGNATURE' }] } }], usage: { inputTokens: 100, outputTokens: 20 }, resolvedModel: 'resolved-test' };
    } };
    const wrapped = session.wrap(model);
    async function* events() {
      yield { type: 'run_started' as const, runId: session.run.id, model: model.model };
      for await (const _ of wrapped.turn(modelRequest)) { void _; }
      yield { type: 'tool_started' as const, callId: 'one', name: 'get_transaction', input: { transaction_id: 'demo' } };
      yield { type: 'tool_finished' as const, callId: 'one', result: { status: 'succeeded' }, failed: false, durationMs: 12 };
      yield { type: 'text_delta' as const, text: 'A visible final answer.' };
      yield { type: 'done' as const, steps: 1, limited: false };
    }
    for await (const _ of session.observe(events())) { void _; }
    expect(session.run).toMatchObject({ status: 'succeeded', input_tokens: 100, output_tokens: 20, estimated_cost_microusd: 900, final_text: 'A visible final answer.' });
    expect(session.run.tool_calls).toMatchObject([{ name: 'get_transaction', result: { status: 'succeeded' }, duration_ms: 12 }]);
    expect(session.run.steps[0].resolved_model).toBe('resolved-test');
    expect(JSON.stringify(writes)).not.toContain('PRIVATE');
    expect(store.start).toHaveBeenCalledTimes(1);
  });
  it('keeps missing usage unknown instead of reporting zero cost', async () => {
    const { store } = storeFixture();
    const session = await startRun({ customer: customers[0], model: 'test', provider: 'test', store });
    const wrapped = session.wrap({ model: 'test', async *turn() { yield { type: 'completed', output: [] }; } });
    for await (const _ of wrapped.turn(modelRequest)) { void _; }
    await session.finish('succeeded');
    expect(session.run.input_tokens).toBeNull();
    expect(session.run.estimated_cost_microusd).toBeNull();
  });
  it('records zero model cost for a guard and preserves reserved budget on provider failure', async () => {
    const { store } = storeFixture();
    const guard = await startRun({ customer: customers[0], model: 'guard', provider: 'guard', store });
    await guard.finish('blocked');
    expect(guard.run.estimated_cost_microusd).toBe(0);
    const session = await startRun({ customer: customers[0], model: 'test', provider: 'test', store });
    const wrapped = session.wrap({ model: 'test', async *turn() { await session.reservation(12345); throw new ModelProviderError('Provider unavailable.'); } });
    async function* events() { for await (const _ of wrapped.turn(modelRequest)) { void _; } }
    await expect(async () => { for await (const _ of session.observe(events())) { void _; } }).rejects.toThrow('Provider unavailable');
    expect(session.run.status).toBe('failed');
    expect(session.run.allocated_cost_microusd).toBe(12345);
    expect(session.run.estimated_cost_microusd).toBeNull();
  });
  it('records known zero usage when a safety limit prevents provider invocation', async () => {
    const { store } = storeFixture();
    const session = await startRun({ customer: customers[0], model: 'test', provider: 'test', store });
    const wrapped = session.wrap({ model: 'test', async *turn() { throw new SafetyLimitError('Budget exhausted.'); } });
    await expect(async () => { for await (const _ of wrapped.turn(modelRequest)) { void _; } }).rejects.toThrow('Budget exhausted');
    expect(session.run.input_tokens).toBe(0);
  });
  it('marks interrupted generators cancelled and saves incomplete tool attempts', async () => {
    const { store } = storeFixture();
    const session = await startRun({ customer: customers[0], model: 'test', provider: 'test', store });
    async function* events() {
      yield { type: 'tool_started' as const, callId: 'one', name: 'get_transaction', input: {} };
      yield { type: 'text_delta' as const, text: 'Never consumed.' };
    }
    for await (const _ of session.observe(events())) { void _; break; }
    expect(session.run.status).toBe('cancelled');
    expect(session.run.tool_calls[0].failed).toBeNull();
    expect(session.run.finished_at).not.toBeNull();
  });
  it('sanitizes raw errors and fails before starting a provider if initial tracing is unavailable', async () => {
    const { store } = storeFixture();
    const session = await startRun({ customer: customers[0], model: 'test', provider: 'test', store });
    await session.finish('failed', new Error('PRIVATE API KEY ERROR BODY'));
    expect(session.run.error_message).not.toContain('PRIVATE');
    vi.mocked(store.start).mockRejectedValue(new Error('Storage unavailable'));
    await expect(startRun({ customer: customers[0], model: 'test', provider: 'test', store })).rejects.toThrow('Storage unavailable');
  });
});
