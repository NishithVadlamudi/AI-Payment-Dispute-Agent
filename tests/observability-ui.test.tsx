// @vitest-environment jsdom
import React from 'react';
import { ThemeProvider } from '../src/components/ui/theme-provider';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RunDashboard } from '../src/components/observability/run-dashboard';
import { runSchema } from '../src/lib/observability/schemas';

const run = runSchema.parse({ id: crypto.randomUUID(), customer_id: null, customer_name: 'Maya Chen', source: 'chat', eval_report_id: null,
  model: 'gemini-test', provider: 'gemini', prompt_version: 'test', status: 'succeeded', steps: [], tool_calls: [], input_tokens: null, output_tokens: null,
  estimated_cost_microusd: null, allocated_cost_microusd: 100000, latency_ms: 1234, final_text: 'Visible final answer.', error_message: null, started_at: new Date().toISOString(), finished_at: new Date().toISOString() });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('under the hood page', () => {
  it('shows missing cost data as unknown, and does not fabricate an evaluation score', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ runs: [run], reports: [] })));
    render(<ThemeProvider><RunDashboard /></ThemeProvider>);
    expect(await screen.findByText('No evaluation score yet')).toBeTruthy();
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
    expect(screen.getByText('$0.100000')).toBeTruthy();
    expect(screen.getByText('Visible final answer.')).toBeTruthy();
  });
  it('labels incomplete live evaluation samples and separates infrastructure failures', async () => {
    const report = { id: crypto.randomUUID(), suite_name: 'test', suite_sha256: 'abc', mode: 'live', model: 'test-model', provider: 'gemini', status: 'partial', dataset_size: 40,
      total_cases: 3, passed: 1, infrastructure_errors: 1, average_latency_ms: 500, average_cost_microusd: 10, cost_coverage: 2, results: [], started_at: new Date().toISOString(), finished_at: new Date().toISOString() };
    const fetchMock = vi.fn().mockImplementation(async () => Response.json({ runs: [], reports: [report] }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ThemeProvider><RunDashboard /></ThemeProvider>);
    expect(await screen.findByText(/LIVE · PARTIAL · SAMPLE/)).toBeTruthy();
    expect(screen.getByText(/not a complete model quality score/)).toBeTruthy();
    await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'eval');
    expect(fetchMock).toHaveBeenCalledWith('/api/observability?source=eval', expect.any(Object));
  });
  it('handles server failures without displaying invented runs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Apply the latest migrations.' }, { status: 503 })));
    render(<ThemeProvider><RunDashboard /></ThemeProvider>);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Apply the latest migrations.');
    expect(screen.queryByText('Maya Chen')).toBeNull();
  });
});
