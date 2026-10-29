import 'server-only';
import { MAX_OUTPUT_TOKENS } from '../../security/limits';
import { GoogleGenAI, FinishReason, FunctionCallingConfigMode, ThinkingLevel } from '@google/genai';
import { usageSchema } from '../../observability/schemas';
import type { Content, Part } from '@google/genai';
import type { ModelCall, ModelClient, ModelInput, ModelOutput } from '../types';
import { ConfigurationError } from '../../db/client';
import { ModelProviderError, providerFailure, providerDiagnostic } from '../errors';

function nativeContents(history: ModelInput[]): Content[] {
  const contents: Content[] = [];
  const calls = new Map<string, ModelCall>();
  for (const item of history) {
    if (item.type === 'provider_context') {
      if (item.provider !== 'gemini') throw new Error('Provider history mismatch.');
      contents.push(structuredClone(item.content));
    } else if (item.type === 'function_call') {
      calls.set(item.call_id, item);
    } else if (item.type === 'function_call_output') {
      const call = calls.get(item.call_id);
      if (!call) throw new Error('Missing function call context.');
      const part: Part = {
        functionResponse: {
          name: call.name,
          response: JSON.parse(item.output),
          ...(call.provider_call_id ? { id: call.provider_call_id } : {}),
        },
      };
      const previous = contents.at(-1);
      if (previous?.role === 'user' && previous.parts?.every((part) => part.functionResponse))
        previous.parts.push(part);
      else contents.push({ role: 'user', parts: [part] });
    } else
      contents.push({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.content }],
      });
  }
  return contents;
}

export function createGeminiClient(): ModelClient {
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_Payment_Dispute_Agent_Key;
  if (!apiKey)
    throw new ConfigurationError(
      'Add GEMINI_API_KEY (or the cloud binding AI_Payment_Dispute_Agent_Key) to the server environment to enable the agent. Create a key in Google AI Studio and check your project’s free-tier model access.',
    );
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const client = new GoogleGenAI({
    apiKey,
    enterprise: false,
    httpOptions: { timeout: 120_000, retryOptions: { attempts: 1 } },
  });
  return {
    model,
    async *turn(request) {
      try {
        request.signal?.throwIfAborted();
        const stream = await client.models.generateContentStream({
          model,
          contents: nativeContents(request.input),
          config: {
            systemInstruction: request.instructions,
            ...(request.tools.length ? { tools: [
              {
                functionDeclarations: request.tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  parametersJsonSchema: tool.parameters,
                })),
              },
            ] } : {}),
            toolConfig: { functionCallingConfig: { mode: request.tools.length ? FunctionCallingConfigMode.AUTO : FunctionCallingConfigMode.NONE } },
            automaticFunctionCalling: { disable: true },
            automaticContinuation: false,
            abortSignal: request.signal,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            candidateCount: 1,
            ...((model === 'gemini-flash-latest' || /^gemini-3[.-]/.test(model))
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        });
        const parts: Part[] = [];
        let finishReason: FinishReason | undefined;
        let usage: { inputTokens: number; outputTokens: number } | undefined;
        let resolvedModel: string | undefined;
        for await (const chunk of stream) {
          request.signal?.throwIfAborted();
          if (chunk.promptFeedback?.blockReason)
            throw new ModelProviderError(
              'The AI provider could not process this question under its content rules. Rephrase it as a payment investigation. Check the approval queue for any refund requests already created.',
            );
          resolvedModel = chunk.modelVersion ?? resolvedModel;
          const metadata = chunk.usageMetadata;
          if (metadata?.promptTokenCount !== undefined) {
            const outputTokens = metadata.candidatesTokenCount !== undefined
              ? metadata.candidatesTokenCount + (metadata.thoughtsTokenCount ?? 0)
              : metadata.totalTokenCount !== undefined
                ? metadata.totalTokenCount - metadata.promptTokenCount : undefined;
            const parsed = usageSchema.safeParse({ inputTokens: metadata.promptTokenCount, outputTokens });
            if (parsed.success && (chunk.candidates?.[0]?.finishReason === FinishReason.STOP || finishReason === FinishReason.STOP)) usage = parsed.data;
          }
          const candidate = chunk.candidates?.[0];
          for (const part of candidate?.content?.parts ?? []) {
            // Preserve exact parts, including function-call thought signatures.
            parts.push(structuredClone(part));
            if (part.text && !part.thought) yield { type: 'text', text: part.text };
          }
          if (candidate?.finishReason) finishReason = candidate.finishReason;
        }
        if (finishReason !== FinishReason.STOP)
          throw new ModelProviderError(
            'The AI response ended before a complete investigation was available. Please try a shorter question. Check the approval queue for any refund requests already created.',
          );
        const output: ModelOutput[] = [
          { type: 'provider_context', provider: 'gemini', content: { role: 'model', parts } },
        ];
        for (const part of parts) {
          const call = part.functionCall;
          if (!call) continue;
          if (!call.name || call.partialArgs || call.willContinue)
            throw new Error('Incomplete function call.');
          output.push({
            type: 'function_call',
            call_id: call.id || crypto.randomUUID(),
            name: call.name,
            arguments: JSON.stringify(call.args ?? {}),
            ...(call.id ? { provider_call_id: call.id } : {}),
          });
        }
        yield { type: 'completed', output, ...(usage ? { usage } : {}), ...(resolvedModel ? { resolvedModel } : {}) };
      } catch (error) {
        request.signal?.throwIfAborted();
        console.warn('gemini_request_failed', providerDiagnostic(error));
        throw providerFailure(error);
      }
    },
  };
}
