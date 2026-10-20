import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRefundStore, RefundError } from '../src/lib/db/refunds';
import { GET } from '../src/app/api/refunds/route';
import { POST } from '../src/app/api/refunds/[id]/route';
import { refunds } from './helpers';

vi.mock('../src/lib/db/client', () => ({ createDatabaseClient: vi.fn() }));
vi.mock('../src/lib/db/refunds', async (original) => ({
  ...await original<typeof import('../src/lib/db/refunds')>(), createRefundStore: vi.fn(),
}));
const decide = vi.fn();
const queue = vi.fn();
const id = refunds[0].id;
const context = { params: Promise.resolve({ id }) };
function request(body: unknown, origin = 'https://demo.example') {
  return new Request(`https://demo.example/api/refunds/${id}`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createRefundStore).mockReturnValue({ decide, queue, request: vi.fn() });
  queue.mockResolvedValue([]);
  decide.mockResolvedValue({ ...refunds[0], status: 'succeeded' });
});
describe('human refund review API', () => {
  it('lists pending requests with caching disabled and handles unavailable storage', async () => {
    const response = await GET();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ refunds: [] });
    queue.mockRejectedValue(new Error('private SQL connection details'));
    const failed = await GET();
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain('private SQL');
  });
  it.each(['approve', 'reject'] as const)('passes only validated %s decisions and IDs to the server store', async (decision) => {
    const response = await POST(request({ decision }), context);
    expect(response.status).toBe(200);
    expect(decide).toHaveBeenCalledWith(id, decision);
  });
  it('accepts the public Host when Next uses an internal bind URL, including a deployment proxy', async () => {
    const hostHeaders: Record<string, string>[] = [
      { Host: 'demo.example' },
      { Host: 'internal:3000', 'X-Forwarded-Host': 'demo.example' },
    ];
    for (const headers of hostHeaders) {
      const req = new Request(`http://0.0.0.0:3000/api/refunds/${id}`, {
        method: 'POST',
        headers: { ...headers, Origin: 'https://demo.example', 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'approve' }),
      });
      expect((await POST(req, context)).status).toBe(200);
    }
  });
  it('rejects forged actor fields, invalid decisions, malformed JSON and invalid UUIDs', async () => {
    for (const body of [{ decision: 'approve', actor: 'admin' }, { decision: 'issue' }, {}]) {
      expect((await POST(request(body), context)).status).toBe(400);
    }
    expect((await POST(request({ decision: 'approve' }), { params: Promise.resolve({ id: 'invalid' }) })).status).toBe(400);
    const malformed = new Request(`https://demo.example/api/refunds/${id}`, { method: 'POST', headers: { Origin: 'https://demo.example' }, body: '{broken' });
    expect((await POST(malformed, context)).status).toBe(400);
    expect(decide).not.toHaveBeenCalled();
  });
  it('rejects cross-site and missing-origin submissions before mutation', async () => {
    expect((await POST(request({ decision: 'approve' }, 'https://other.example'), context)).status).toBe(403);
    expect((await POST(new Request(`https://demo.example/api/refunds/${id}`, { method: 'POST' }), context)).status).toBe(403);
    expect(decide).not.toHaveBeenCalled();
  });
  it('reports business conflicts safely and database outages as retryable failures', async () => {
    decide.mockRejectedValueOnce(new RefundError('REFUND_DECISION_CONFLICT'));
    const conflict = await POST(request({ decision: 'approve' }), context);
    expect(conflict.status).toBe(409);
    expect(await conflict.text()).toContain('Refresh the queue');
    decide.mockRejectedValueOnce(new Error('secret database password'));
    const failure = await POST(request({ decision: 'approve' }), context);
    expect(failure.status).toBe(503);
    expect(await failure.text()).not.toContain('secret');
  });
});
