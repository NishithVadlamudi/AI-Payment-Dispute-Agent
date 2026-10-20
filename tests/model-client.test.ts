import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createModelClient } from '../src/lib/agent/client';
import type { ModelInput } from '../src/lib/agent/types';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({
  default: class {
    responses = { create };
  },
}));

async function collect(input: ModelInput[] = []) {
  const client = createModelClient();
  const events = [];
  for await (const event of client.turn({ instructions: 'Read only.', input, tools: [] }))
    events.push(event);
  return { client, events };
}

describe('OpenAI streaming adapter', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('AI_PROVIDER', 'openai');
    vi.stubEnv('DISPUTE_OPENAI_API_KEY', '');
    create.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it('requires a server-side API key', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(createModelClient).toThrow('Add OPENAI_API_KEY');
  });
  it('uses the configured model, streams text, and preserves completed output', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-only-not-a-real-key');
    vi.stubEnv('OPENAI_MODEL', 'chosen-model');
    create.mockResolvedValue(
      (async function* () {
        yield { type: 'response.output_text.delta', delta: 'Found it.' };
        yield {
          type: 'response.completed',
          response: {
            output: [
              {
                type: 'function_call',
                name: 'get_refund_policy',
                call_id: 'call_1',
                arguments: '{"reason":"other"}',
              },
            ],
          },
        };
      })(),
    );
    const { client, events } = await collect();
    expect(client.model).toBe('chosen-model');
    expect(events[0]).toEqual({ type: 'text', text: 'Found it.' });
    expect(events[1]).toMatchObject({
      type: 'completed',
      output: [{ type: 'provider_context', provider: 'openai' }, { type: 'function_call' }],
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'chosen-model',
        stream: true,
        store: false,
        include: ['reasoning.encrypted_content'],
      }),
      expect.any(Object),
    );
  });
  it('captures provider-reported input and output usage including reasoning within output totals', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-only-not-a-real-key');
    create.mockResolvedValue((async function* () {
      yield { type: 'response.completed', response: { output: [], model: 'resolved-openai', usage: { input_tokens: 120, output_tokens: 45, output_tokens_details: { reasoning_tokens: 30 } } } };
    })());
    const { events } = await collect();
    expect(events.at(-1)).toMatchObject({ type: 'completed', usage: { inputTokens: 120, outputTokens: 45 }, resolvedModel: 'resolved-openai' });
  });
  it('uses gpt-5-mini by default and reports incomplete or interrupted streams', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-only-not-a-real-key');
    vi.stubEnv('OPENAI_MODEL', '');
    expect(createModelClient().model).toBe('gpt-5-mini');
    create.mockResolvedValue(
      (async function* () {
        yield { type: 'response.incomplete' };
      })(),
    );
    await expect(collect()).rejects.toThrow('could not finish');
    create.mockResolvedValue(
      (async function* () {
        yield { type: 'response.output_text.delta', delta: 'Partial' };
      })(),
    );
    await expect(collect()).rejects.toThrow('could not finish');
  });
  it('supports the cloud secret alias when the standard key is unavailable', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('DISPUTE_OPENAI_API_KEY', 'test-only-cloud-placeholder');
    expect(createModelClient().model).toBeTruthy();
  });
  it('preserves native reasoning context and sends each tool call only once on continuation', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-only-not-a-real-key');
    const native = [
      { type: 'reasoning', id: 'rs_1', summary: [], encrypted_content: 'opaque-context' },
      {
        type: 'function_call',
        call_id: 'call_1',
        name: 'get_refund_policy',
        arguments: '{"reason":"other"}',
      },
    ];
    create
      .mockResolvedValueOnce(
        (async function* () {
          yield { type: 'response.completed', response: { output: native } };
        })(),
      )
      .mockResolvedValueOnce(
        (async function* () {
          yield { type: 'response.output_text.delta', delta: 'Needs review.' };
          yield { type: 'response.completed', response: { output: [] } };
        })(),
      );
    const first = await collect();
    const completed = first.events.find((event) => event.type === 'completed');
    if (!completed || completed.type !== 'completed') throw new Error('Expected completion');
    await collect([
      ...completed.output,
      { type: 'function_call_output', call_id: 'call_1', output: '{"requires_approval":true}' },
    ]);
    expect(create.mock.calls[1][0].input).toEqual([
      ...native,
      { type: 'function_call_output', call_id: 'call_1', output: '{"requires_approval":true}' },
    ]);
  });
});
