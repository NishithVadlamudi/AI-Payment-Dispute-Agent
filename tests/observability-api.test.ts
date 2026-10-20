import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../src/app/api/observability/route';
import { recentRuns } from '../src/lib/observability/store';
import { createEvalStore } from '../src/lib/evals/store';
vi.mock('../src/lib/db/client', () => ({ createDatabaseClient: () => ({}) }));
vi.mock('../src/lib/observability/store', () => ({ recentRuns: vi.fn() }));
vi.mock('../src/lib/evals/store', () => ({ createEvalStore: vi.fn() }));
beforeEach(() => {
  vi.mocked(recentRuns).mockReset().mockResolvedValue([]);
  vi.mocked(createEvalStore).mockReturnValue({ recent: async () => [], save: vi.fn() });
});
describe('read-only observability API', () => {
  it('loads bounded recent chat runs and eval reports with no caching', async () => {
    const response = await GET(new Request('http://local/api/observability'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ runs: [], reports: [] });
    expect(recentRuns).toHaveBeenCalledWith({}, 'chat', undefined);
  });
  it('validates the source filter before database reads', async () => {
    expect((await GET(new Request('http://local/api/observability?source=private'))).status).toBe(400);
    expect(recentRuns).not.toHaveBeenCalled();
    expect((await GET(new Request('http://local/api/observability?source=eval'))).status).toBe(200);
    expect(recentRuns).toHaveBeenCalledWith({}, 'eval', undefined);
  });
  it('validates a selected trace ID and reads only that run', async () => {
    expect((await GET(new Request('http://local/api/observability?run_id=invalid'))).status).toBe(400);
    expect(recentRuns).not.toHaveBeenCalled();
    const id = crypto.randomUUID();
    expect((await GET(new Request(`http://local/api/observability?source=all&run_id=${id}`))).status).toBe(200);
    expect(recentRuns).toHaveBeenCalledWith({}, 'all', id);
  });
  it('does not expose database error payloads', async () => {
    vi.mocked(recentRuns).mockRejectedValue(new Error('SECRET DATABASE DETAILS'));
    const response = await GET(new Request('http://local/api/observability'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('SECRET');
  });
});
