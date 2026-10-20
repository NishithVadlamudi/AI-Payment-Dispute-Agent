import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockedReason, FinishReason, ThinkingLevel } from '@google/genai';
import type { GenerateContentResponse, GenerateContentParameters } from '@google/genai';
import { createModelClient } from '../src/lib/agent/client';
import type { ModelClient, ModelEvent, ModelInput, ModelOutput } from '../src/lib/agent/types';
import { runAgent } from '../src/lib/agent/loop';
import { tools } from '../src/lib/tools/definitions';
import { fakeStore, customers } from './helpers';

const { generate, geminiConstruct, openaiConstruct } = vi.hoisted(() => ({
  generate: vi.fn(),
  geminiConstruct: vi.fn(),
  openaiConstruct: vi.fn(),
}));
vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/genai')>();
  return {
    ...actual,
    GoogleGenAI: class {
      constructor(options: unknown) {
        geminiConstruct(options);
      }
      models = { generateContentStream: generate };
    },
  };
});
vi.mock('openai', () => ({
  default: class {
    constructor(options: unknown) {
      openaiConstruct(options);
    }
  },
}));

function stream(chunks: Partial<GenerateContentResponse>[]) {
  return (async function* () {
    for (const chunk of chunks) yield chunk;
  })();
}
const answer = () =>
  stream([
    {
      candidates: [
        {
          content: { role: 'model', parts: [{ text: 'The evidence needs review.' }] },
          finishReason: FinishReason.STOP,
        },
      ],
    },
  ]);
async function collect(client: ModelClient, input: ModelInput[] = [], signal?: AbortSignal) {
  const events: ModelEvent[] = [];
  for await (const event of client.turn({ instructions: 'Read only.', input, tools, signal }))
    events.push(event);
  return events;
}

describe('Gemini native streaming adapter', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.stubEnv('AI_PROVIDER', '');
    vi.stubEnv('GEMINI_API_KEY', 'test-only-not-a-real-key');
    vi.stubEnv('AI_Payment_Dispute_Agent_Key', '');
    vi.stubEnv('GEMINI_MODEL', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('selects Gemini by default and requires its own key even when OpenAI is configured', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('OPENAI_API_KEY', 'test-only-paid-key');
    expect(createModelClient).toThrow('Add GEMINI_API_KEY');
    expect(openaiConstruct).not.toHaveBeenCalled();
  });
  it('rejects unknown providers instead of silently selecting a paid provider', () => {
    vi.stubEnv('AI_PROVIDER', 'typo');
    expect(createModelClient).toThrow('Unsupported AI_PROVIDER');
  });
  it('accepts the existing published cloud binding without requiring a duplicate key', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('AI_Payment_Dispute_Agent_Key', 'test-only-cloud-key');
    createModelClient();
    expect(geminiConstruct).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'test-only-cloud-key' }));
  });
  it('uses the validated Flash Lite model, schemas, and manual bounded continuation', async () => {
    generate.mockResolvedValue(answer());
    const client = createModelClient();
    expect(client.model).toBe('gemini-3.5-flash-lite');
    const events = await collect(client, [{ role: 'user', content: 'Investigate a payment.' }]);
    expect(events[0]).toEqual({ type: 'text', text: 'The evidence needs review.' });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.5-flash-lite',
        contents: [{ role: 'user', parts: [{ text: 'Investigate a payment.' }] }],
        config: expect.objectContaining({
          automaticFunctionCalling: { disable: true },
          automaticContinuation: false,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools: [
            {
              functionDeclarations: tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                parametersJsonSchema: tool.parameters,
              })),
            },
          ],
        }),
      }),
    );
    expect(geminiConstruct).toHaveBeenCalledWith(
      expect.objectContaining({
        enterprise: false,
        httpOptions: { timeout: 120000, retryOptions: { attempts: 1 } },
      }),
    );
  });
  it('captures cumulative token usage once, including thought tokens, without streaming private text', async () => {
    generate.mockResolvedValue(stream([
      { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 3, thoughtsTokenCount: 2 }, candidates: [{ content: { parts: [{ text: 'Visible.' }] } }] },
      { modelVersion: 'resolved-gemini', usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 10, thoughtsTokenCount: 5 }, candidates: [{ finishReason: FinishReason.STOP }] },
    ]));
    const events = await collect(createModelClient());
    expect(events.at(-1)).toMatchObject({ type: 'completed', usage: { inputTokens: 100, outputTokens: 15 }, resolvedModel: 'resolved-gemini' });
    expect(events.filter((event) => event.type === 'text')).toEqual([{ type: 'text', text: 'Visible.' }]);
  });
  it('does not present partial stream counters as final usage when final metadata is missing', async () => {
    generate.mockResolvedValue(stream([
      { usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 3 }, candidates: [{ content: { parts: [{ text: 'Visible.' }] } }] },
      { candidates: [{ finishReason: FinishReason.STOP }] },
    ]));
    const events = await collect(createModelClient());
    expect(events.at(-1)).not.toHaveProperty('usage');
  });
  it('honors a configured model and keeps private thought text out of streamed answers', async () => {
    vi.stubEnv('GEMINI_MODEL', 'chosen-eligible-model');
    generate.mockResolvedValue(
      stream([
        {
          candidates: [
            {
              content: {
                parts: [
                  { text: 'Private internal reasoning', thought: true, thoughtSignature: 'opaque' },
                  { text: 'Public answer.' },
                ],
              },
              finishReason: FinishReason.STOP,
            },
          ],
        },
      ]),
    );
    const client = createModelClient();
    expect(client.model).toBe('chosen-eligible-model');
    const events = await collect(client);
    expect(events.filter((event) => event.type === 'text')).toEqual([
      { type: 'text', text: 'Public answer.' },
    ]);
  });
  it('preserves signed native calls, groups parallel results, and continues the real agent loop', async () => {
    const nativeParts = [
      {
        functionCall: {
          id: 'native-1',
          name: 'get_refund_policy',
          args: { reason: 'duplicate_charge' },
        },
        thoughtSignature: 'signature-one',
      },
      {
        functionCall: {
          id: 'native-2',
          name: 'explain_decline_code',
          args: { code: 'insufficient_funds' },
        },
      },
    ];
    generate
      .mockResolvedValueOnce(
        stream([
          {
            candidates: [
              { content: { role: 'model', parts: nativeParts }, finishReason: FinishReason.STOP },
            ],
          },
        ]),
      )
      .mockResolvedValueOnce(answer());
    const events = [];
    for await (const event of runAgent({
      customer: customers[0],
      messages: [{ role: 'user', content: 'Investigate.' }],
      model: createModelClient(),
      store: fakeStore(),
    }))
      events.push(event);
    expect(events.at(-1)).toEqual({ type: 'done', steps: 2, limited: false });
    expect(events.filter((event) => event.type === 'tool_finished')).toHaveLength(2);
    const next = generate.mock.calls[1][0] as GenerateContentParameters;
    expect(next.contents).toEqual([
      { role: 'user', parts: [{ text: 'Investigate.' }] },
      { role: 'model', parts: nativeParts },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: 'get_refund_policy',
              id: 'native-1',
              response: expect.objectContaining({ requires_approval: true }),
            },
          },
          {
            functionResponse: {
              name: 'explain_decline_code',
              id: 'native-2',
              response: expect.objectContaining({ known: true }),
            },
          },
        ],
      },
    ]);
    expect(JSON.stringify(events)).not.toContain('signature-one');
  });
  it('supports calls without native IDs and returns tool errors using the same function name', async () => {
    generate
      .mockResolvedValueOnce(
        stream([
          {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: 'get_transaction',
                        args: { transaction_id: 'invalid-id' },
                      },
                      thoughtSignature: 'signed',
                    },
                  ],
                },
                finishReason: FinishReason.STOP,
              },
            ],
          },
        ]),
      )
      .mockResolvedValueOnce(answer());
    const client = createModelClient();
    const first = await collect(client);
    const completed = first.find((event) => event.type === 'completed');
    expect(completed?.type).toBe('completed');
    const output: ModelOutput[] = completed?.type === 'completed' ? completed.output : [];
    const call = output.find((item) => item.type === 'function_call');
    expect(call).toBeDefined();
    if (!call || call.type !== 'function_call') throw new Error('Expected native function call');
    await collect(client, [
      ...output,
      {
        type: 'function_call_output',
        call_id: call.call_id,
        output: JSON.stringify({ error: { code: 'INVALID_INPUT', message: 'Invalid UUID' } }),
      },
    ]);
    const request = generate.mock.calls[1][0] as GenerateContentParameters;
    expect(request.contents).toContainEqual({
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: 'get_transaction',
            response: { error: { code: 'INVALID_INPUT', message: 'Invalid UUID' } },
          },
        },
      ],
    });
  });
  it.each([FinishReason.MAX_TOKENS, FinishReason.SAFETY, FinishReason.CONTINUATION])(
    'does not treat %s as a completed investigation',
    async (finishReason) => {
      generate.mockResolvedValue(
        stream([
          {
            candidates: [
              {
                content: {
                  parts: [
                    { functionCall: { name: 'get_refund_policy', args: { reason: 'other' } } },
                  ],
                },
                finishReason,
              },
            ],
          },
        ]),
      );
      await expect(collect(createModelClient())).rejects.toThrow(
        'ended before a complete investigation',
      );
    },
  );
  it('rejects interrupted streams and blocked prompts', async () => {
    generate
      .mockResolvedValueOnce(
        stream([{ candidates: [{ content: { parts: [{ text: 'Partial' }] } }] }]),
      )
      .mockResolvedValueOnce(stream([{ promptFeedback: { blockReason: BlockedReason.SAFETY } }]));
    await expect(collect(createModelClient())).rejects.toThrow('ended before');
    await expect(collect(createModelClient())).rejects.toThrow('content rules');
  });
  it('reports exhausted quota without leaking provider payloads or falling back to OpenAI', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-only-paid-key');
    generate.mockRejectedValue({ status: 429, message: 'sensitive provider body' });
    await expect(collect(createModelClient())).rejects.toThrow('quota has been reached');
    expect(openaiConstruct).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('propagates cancellation and sends the signal to the native SDK', async () => {
    const abort = new AbortController();
    generate.mockResolvedValue(answer());
    await collect(createModelClient(), [], abort.signal);
    expect(generate.mock.calls[0][0].config.abortSignal).toBe(abort.signal);
    abort.abort();
    await expect(collect(createModelClient(), [], abort.signal)).rejects.toThrow();
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
