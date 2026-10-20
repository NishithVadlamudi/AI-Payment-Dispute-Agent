import 'server-only';
import type { ModelClient } from '../agent/types';
import type { AgentEvent } from '../agent/events';
import type { Customer } from '../db/schemas';
import { usageSchema, type AgentRun, type RunStep } from './schemas';
import type { TraceStore } from './store';
import { SafetyLimitError } from '../security/controls';
import { agentFailureMessage } from '../agent/errors';

export const PROMPT_VERSION = 'phase4-v1';
export async function startRun(options: {
  customer: Customer; model: string; provider: string; store: TraceStore;
  source?: 'chat' | 'eval'; evalReportId?: string;
}) {
  const began = performance.now();
  const run: AgentRun = {
    id: crypto.randomUUID(), customer_id: options.customer.id, customer_name: options.customer.name,
    source: options.source ?? 'chat', eval_report_id: options.evalReportId ?? null,
    model: options.model, provider: options.provider, prompt_version: PROMPT_VERSION, status: 'running',
    steps: [], tool_calls: [], input_tokens: null, output_tokens: null,
    estimated_cost_microusd: null, allocated_cost_microusd: 0, latency_ms: null,
    final_text: '', error_message: null, started_at: new Date().toISOString(), finished_at: null,
  };
  await options.store.start(structuredClone(run));
  let currentStep: RunStep | undefined;
  const save = () => options.store.save(structuredClone(run));
  function summarize() {
    const known = run.steps.every((step) => step.input_tokens !== null && step.output_tokens !== null);
    run.input_tokens = known ? run.steps.reduce((sum, step) => sum + step.input_tokens!, 0) : null;
    run.output_tokens = known ? run.steps.reduce((sum, step) => sum + step.output_tokens!, 0) : null;
    run.estimated_cost_microusd = known
      ? run.steps.reduce((sum, step) => sum + step.estimated_cost_microusd!, 0) : null;
  }
  async function finish(status: AgentRun['status'], error?: unknown) {
    run.status = status;
    run.error_message = error ? agentFailureMessage(error) : run.error_message;
    run.latency_ms = Math.round(performance.now() - began);
    run.finished_at = new Date().toISOString();
    summarize();
    await save();
  }
  return {
    run,
    finish,
    async reservation(amount: number) {
      run.allocated_cost_microusd += amount;
      if (currentStep) currentStep.allocated_cost_microusd += amount;
      await save();
    },
    wrap(model: ModelClient): ModelClient {
      return {
        model: model.model,
        async *turn(request) {
          const step: RunStep = {
            step: run.steps.length + 1, status: 'running', latency_ms: null,
            input_tokens: null, output_tokens: null, estimated_cost_microusd: null,
            allocated_cost_microusd: 0, resolved_model: null,
          };
          currentStep = step;
          run.steps.push(step);
          await save();
          const start = performance.now();
          try {
            for await (const event of model.turn(request)) {
              if (event.type === 'completed') {
                const usage = usageSchema.safeParse(event.usage);
                if (usage.success) {
                  step.input_tokens = usage.data.inputTokens;
                  step.output_tokens = usage.data.outputTokens;
                  const inputRate = Number(process.env.AI_INPUT_MICROUSD_PER_TOKEN || 5);
                  const outputRate = Number(process.env.AI_OUTPUT_MICROUSD_PER_TOKEN || 20);
                  step.estimated_cost_microusd = step.input_tokens * inputRate + step.output_tokens * outputRate;
                }
                step.resolved_model = event.resolvedModel ?? null;
                step.status = 'succeeded';
              }
              yield event;
            }
            if (step.status === 'running') step.status = 'failed';
          } catch (error) {
            if (error instanceof SafetyLimitError && step.allocated_cost_microusd === 0) {
              step.input_tokens = 0; step.output_tokens = 0; step.estimated_cost_microusd = 0;
            }
            step.status = request.signal?.aborted ? 'cancelled' : 'failed';
            throw error;
          } finally {
            step.latency_ms = Math.round(performance.now() - start);
            summarize();
            await save();
          }
        },
      };
    },
    async *observe(events: AsyncIterable<AgentEvent>, signal?: AbortSignal): AsyncGenerator<AgentEvent> {
      let terminal = false;
      let emittedError = false;
      try {
        for await (const event of events) {
          if (event.type === 'text_delta') run.final_text = (run.final_text + event.text).slice(0, 16000);
          if (event.type === 'tool_started') { run.tool_calls.push({
            call_id: event.callId, name: event.name, input: event.input as AgentRun['tool_calls'][number]['input'],
            result: null, failed: null, duration_ms: null,
          }); await save(); }
          if (event.type === 'tool_finished') {
            const call = [...run.tool_calls].reverse().find((call) => call.call_id === event.callId && call.failed === null);
            if (call) Object.assign(call, { result: event.result, failed: event.failed, duration_ms: event.durationMs });
            await save();
          }
          if (event.type === 'error') {
            emittedError = true; run.error_message = event.message;
            await finish('failed');
          }
          if (event.type === 'done') {
            await finish(emittedError ? 'failed' : event.limited ? 'limited' : 'succeeded');
            terminal = true;
          }
          yield event;
        }
      } catch (error) {
        terminal = true;
        await finish(signal?.aborted ? 'cancelled' : 'failed', error);
        throw error;
      } finally {
        if (!terminal) await finish(signal?.aborted ? 'cancelled' : emittedError ? 'failed' : 'cancelled');
      }
    },
  };
}
