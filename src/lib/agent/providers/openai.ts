import 'server-only';
import { MAX_OUTPUT_TOKENS } from '../../security/limits';
import { usageSchema } from '../../observability/schemas';
import OpenAI from 'openai';
import type { ResponseInput } from 'openai/resources/responses/responses';
import type { ModelClient, ModelInput, ModelOutput } from '../types';
import { ConfigurationError } from '../../db/client';
import { providerFailure } from '../errors';

function nativeInput(history: ModelInput[]): ResponseInput {
  const input: ResponseInput = [];
  for (const item of history) {
    if (item.type === 'provider_context') {
      if (item.provider !== 'openai') throw new Error('Provider history mismatch.');
      // Only these output variants are requested by this adapter.
      for (const output of item.output) {
        if (
          output.type !== 'message' &&
          output.type !== 'reasoning' &&
          output.type !== 'function_call'
        )
          throw new Error('Unsupported model output.');
        input.push(output);
      }
    } else if (item.type === 'function_call') {
      const preserved = history.some(
        (entry) =>
          entry.type === 'provider_context' &&
          entry.provider === 'openai' &&
          entry.output.some(
            (output) => output.type === 'function_call' && output.call_id === item.call_id,
          ),
      );
      if (!preserved)
        input.push({
          type: 'function_call',
          call_id: item.call_id,
          name: item.name,
          arguments: item.arguments,
        });
    } else input.push(item);
  }
  return input;
}

export function createOpenAIClient(): ModelClient {
  const apiKey = process.env.DISPUTE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey)
    throw new ConfigurationError(
      'Add OPENAI_API_KEY locally, or DISPUTE_OPENAI_API_KEY in cloud environment settings, to use AI_PROVIDER=openai.',
    );
  const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
  const client = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 0 });
  return {
    model,
    async *turn(request) {
      try {
        const stream = await client.responses.create(
          {
            model,
            instructions: request.instructions,
            input: nativeInput(request.input),
            tools: request.tools,
            stream: true,
            store: false,
            include: ['reasoning.encrypted_content'],
            max_output_tokens: MAX_OUTPUT_TOKENS,
          },
          { signal: request.signal },
        );
        let completed = false;
        for await (const event of stream) {
          if (
            event.type === 'response.output_text.delta' ||
            event.type === 'response.refusal.delta'
          )
            yield { type: 'text', text: event.delta };
          if (event.type === 'response.completed') {
            const output = event.response.output;
            if (
              output.some(
                (item) =>
                  item.type !== 'message' &&
                  item.type !== 'function_call' &&
                  item.type !== 'reasoning',
              )
            )
              throw new Error('Unsupported model output.');
            const normalized: ModelOutput[] = [
              { type: 'provider_context', provider: 'openai', output },
              ...output
                .filter((item) => item.type === 'function_call')
                .map((item) => ({
                  type: 'function_call' as const,
                  call_id: item.call_id,
                  name: item.name,
                  arguments: item.arguments,
                })),
            ];
            completed = true;
            const usage = usageSchema.safeParse({ inputTokens: event.response.usage?.input_tokens, outputTokens: event.response.usage?.output_tokens });
            yield { type: 'completed', output: normalized, ...(usage.success ? { usage: usage.data } : {}), resolvedModel: event.response.model };
          }
          if (
            event.type === 'response.failed' ||
            event.type === 'response.incomplete' ||
            event.type === 'error'
          )
            throw new Error('Model response did not complete.');
        }
        if (!completed) throw new Error('Model response stream was interrupted.');
      } catch (error) {
        request.signal?.throwIfAborted();
        throw providerFailure(error);
      }
    },
  };
}
