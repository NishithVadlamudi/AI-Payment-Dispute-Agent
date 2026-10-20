import { createDatabaseClient, ConfigurationError } from '@/lib/db/client';
import { createStore } from '@/lib/db/queries';
import type { ModelClient } from '@/lib/agent/types';
import { createModelClient } from '@/lib/agent/client';
import { runAgent } from '@/lib/agent/loop';
import { encodeEvent } from '@/lib/agent/events';
import { chatRequestSchema } from '@/lib/validation/chat';
import { AuditUnavailableError } from '@/lib/db/audit';
import { agentFailureMessage } from '@/lib/agent/errors';
import { createAbuseControls, SafetyLimitError } from '@/lib/security/controls';
import { readChatBody, requestBucket, RequestBodyError } from '@/lib/security/request';
import { createTraceStore } from '@/lib/observability/store';
import { startRun } from '@/lib/observability/session';
import { TraceUnavailableError } from '@/lib/observability/errors';
import { hasUnsafeOverride, injectionRefusal, GUARD_MODEL_LABEL } from '@/lib/security/injection';

export const runtime = 'nodejs';
export const maxDuration = 300;
const streamHeaders = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
};

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await readChatBody(request);
  } catch (error) {
    return Response.json(
      { error: error instanceof RequestBodyError ? error.message : 'Send a valid JSON chat request.' },
      { status: error instanceof RequestBodyError ? error.status : 400 },
    );
  }
  const parsed = chatRequestSchema.safeParse(raw);
  if (!parsed.success)
    return Response.json({
      error: 'Select a demo customer and send a message of up to 4,000 characters. Use at most 20 messages and 24,000 characters per conversation; start a new chat when it grows too long.',
    }, { status: 400 });

  try {
    const db = createDatabaseClient();
    const controls = createAbuseControls(db);
    await controls.checkRate(requestBucket(request));
    const store = createStore(db);
    const customer = await store.customer(parsed.data.customer_id);
    if (!customer)
      return Response.json({ error: 'That demo customer was not found. Refresh the customer list and try again.' }, { status: 404 });

    if (hasUnsafeOverride(parsed.data.messages)) {
      const session = await startRun({ customer, model: GUARD_MODEL_LABEL, provider: 'guard', store: createTraceStore(db) });
      const runId = session.run.id;
      try {
        await store.audit({
          run_id: runId, actor: 'system', action: 'injection_blocked', customer_id: customer.id,
          payload: { rule: 'explicit_instruction_override', model_called: false },
        });
        session.run.final_text = injectionRefusal;
        await session.finish('blocked');
      } catch (error) {
        await session.finish('failed', error);
        throw error;
      }
      // Label this as a deterministic guard; never present it as a model response.
      return new Response([
        encodeEvent({ type: 'run_started', runId, model: GUARD_MODEL_LABEL }),
        encodeEvent({ type: 'text_delta', text: injectionRefusal }),
        encodeEvent({ type: 'done', steps: 0, limited: false }),
      ].join(''), { headers: streamHeaders });
    }

    const rawModel = createModelClient();
    const session = await startRun({ customer, model: rawModel.model, provider: (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase(), store: createTraceStore(db) });
    let model: ModelClient;
    try { model = session.wrap(controls.protect(rawModel, { onReservation: session.reservation })); }
    catch (error) { await session.finish('failed', error); throw error; }
    const abort = new AbortController();
    const signal = AbortSignal.any([request.signal, abort.signal]);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of session.observe(runAgent({
            customer, messages: parsed.data.messages, store, model, signal, runId: session.run.id,
          }), signal)) {
            if (signal.aborted) return;
            controller.enqueue(encoder.encode(encodeEvent(event)));
          }
        } catch (error) {
          if (!signal.aborted)
            controller.enqueue(encoder.encode(encodeEvent({
              type: 'error',
              message: agentFailureMessage(error),
            })));
        } finally {
          if (!signal.aborted) controller.close();
        }
      },
      cancel() { abort.abort(); },
    });
    return new Response(stream, { headers: streamHeaders });
  } catch (error) {
    const safe = error instanceof ConfigurationError || error instanceof SafetyLimitError || error instanceof AuditUnavailableError || error instanceof TraceUnavailableError;
    return Response.json({
      error: safe ? error.message : 'The demo database could not be reached. Please try again shortly.',
    }, {
      status: error instanceof SafetyLimitError ? error.status : 503,
      headers: error instanceof SafetyLimitError && error.retryAfter
        ? { 'Retry-After': String(error.retryAfter) } : undefined,
    });
  }
}
