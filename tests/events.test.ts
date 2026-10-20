import { describe, expect, it } from 'vitest';
import { encodeEvent, readAgentEvents } from '../src/lib/agent/events';

async function decode(bytes: Uint8Array, split: number) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, split));
      controller.enqueue(bytes.slice(split));
      controller.close();
    },
  });
  const events = [];
  for await (const event of readAgentEvents(stream)) events.push(event);
  return events;
}
describe('stream framing', () => {
  it('handles arbitrary chunk boundaries, including split UTF-8 characters', async () => {
    const event = { type: 'text_delta' as const, text: 'A refund — $65.00 ✓' };
    const bytes = new TextEncoder().encode(encodeEvent(event));
    for (let i = 1; i < bytes.length; i++) expect(await decode(bytes, i)).toEqual([event]);
  });
  it('rejects truncated frames and invalid event payloads', async () => {
    await expect(decode(new TextEncoder().encode('data: {"type":"done"}'), 3)).rejects.toThrow();
    await expect(
      decode(new TextEncoder().encode('data: {"type":"unknown"}\n\n'), 3),
    ).rejects.toThrow();
  });
});
