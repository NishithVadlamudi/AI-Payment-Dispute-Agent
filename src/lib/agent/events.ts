import { z } from 'zod';

export const agentEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('run_started'), runId: z.uuid(), model: z.string() }),
  z.object({ type: z.literal('step_started'), step: z.number().int().positive() }),
  z.object({ type: z.literal('text_delta'), text: z.string() }),
  z.object({
    type: z.literal('tool_started'),
    callId: z.string(),
    name: z.string(),
    input: z.unknown(),
  }),
  z.object({
    type: z.literal('tool_finished'),
    callId: z.string(),
    result: z.unknown(),
    failed: z.boolean(),
    durationMs: z.number().nonnegative(),
  }),
  z.object({ type: z.literal('done'), steps: z.number().int(), limited: z.boolean() }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type AgentEvent = z.infer<typeof agentEventSchema>;

export function encodeEvent(event: AgentEvent) {
  return `data: ${JSON.stringify(agentEventSchema.parse(event))}\n\n`;
}

export async function* readAgentEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (frame.startsWith('data: ')) yield agentEventSchema.parse(JSON.parse(frame.slice(6)));
      }
      if (done) {
        if (buffer.trim()) throw new Error('The response stream ended unexpectedly.');
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
