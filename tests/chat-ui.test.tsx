// @vitest-environment jsdom
import React from 'react';
import { ThemeProvider } from '../src/components/ui/theme-provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatWorkspace } from '../src/components/chat/chat-workspace';
import { customers } from './helpers';
import { encodeEvent } from '../src/lib/agent/events';
import { GUARD_MODEL_LABEL, injectionRefusal } from '../src/lib/security/injection';
import { scenarios } from '../src/lib/demo/scenarios';

function streamResponse() {
  return new Response(
    [
      encodeEvent({ type: 'step_started', step: 1 }),
      encodeEvent({
        type: 'tool_started',
        callId: 'demo-call',
        name: 'search_transactions',
        input: { customer_id: customers[0].id, amount: 8499, date_range: null },
      }),
      encodeEvent({
        type: 'tool_finished',
        callId: 'demo-call',
        result: { transactions: [], truncated: false },
        failed: false,
        durationMs: 8,
      }),
      encodeEvent({ type: 'text_delta', text: 'Two matching charges need review.' }),
      encodeEvent({ type: 'done', steps: 1, limited: false }),
    ].join(''),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}

describe('chat workspace', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock
      .mockReset()
      .mockImplementation(async (url: string) =>
        url === '/api/customers' ? Response.json({ customers }) : streamResponse(),
      );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    Element.prototype.scrollIntoView = vi.fn();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('prefills the matching customer and question, streams an answer, and exposes tool evidence', async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><ChatWorkspace /></ThemeProvider>);
    await waitFor(() =>
      expect((screen.getByLabelText('DEMO CUSTOMER') as HTMLSelectElement).value).toBe(
        customers[0].id,
      ),
    );
    await user.click(screen.getByRole('button', { name: /double charge/i }));
    expect(
      (screen.getByLabelText('Describe your payment problem') as HTMLTextAreaElement).value,
    ).toBe(scenarios[0].message);
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Two matching charges need review.')).toBeTruthy();
    expect(screen.getByText('search_transactions')).toBeTruthy();
    const post = fetchMock.mock.calls.find(([url]) => url === '/api/chat');
    expect(post).toBeTruthy();
    expect(JSON.parse(post![1].body)).toMatchObject({
      customer_id: customers[0].id,
      messages: [{ role: 'user', content: scenarios[0].message }],
    });
    await user.selectOptions(screen.getByLabelText('DEMO CUSTOMER'), customers[1].id);
    expect(screen.queryByText('Two matching charges need review.')).toBeNull();
  });
  it('shows the injection scenario as a system guard result with no fictional tool activity', async () => {
    fetchMock.mockImplementation(async (url: string) => url === '/api/customers'
      ? Response.json({ customers })
      : new Response([
        encodeEvent({ type: 'run_started', runId: '00000000-0000-4000-8000-000000000999', model: GUARD_MODEL_LABEL }),
        encodeEvent({ type: 'text_delta', text: injectionRefusal }),
        encodeEvent({ type: 'done', steps: 0, limited: false }),
      ].join('')));
    const user = userEvent.setup();
    render(<ThemeProvider><ChatWorkspace /></ThemeProvider>);
    await screen.findByRole('option', { name: 'Maya Chen' });
    await user.click(screen.getByRole('button', { name: /injection attempt/i }));
    expect((screen.getByLabelText('Describe your payment problem') as HTMLTextAreaElement).value).toContain('refund $5,000');
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('SYSTEM GUARD')).toBeTruthy();
    expect(screen.getByText('Blocked before model invocation. No tools ran.')).toBeTruthy();
    expect(screen.queryByText('Agent reasoning')).toBeNull();
  });
  it('shows server errors in plain language without fabricating an answer', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === '/api/customers'
        ? Response.json({ customers })
        : Response.json({ error: 'The API key is not configured.' }, { status: 503 }),
    );
    const user = userEvent.setup();
    render(<ThemeProvider><ChatWorkspace /></ThemeProvider>);
    await screen.findByRole('option', { name: 'Maya Chen' });
    await user.click(screen.getByRole('button', { name: /failed payment/i }));
    expect((screen.getByLabelText('DEMO CUSTOMER') as HTMLSelectElement).value).toBe(
      customers[1].id,
    );
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('API key is not configured'),
    );
    expect(screen.getByText(/This investigation is incomplete/)).toBeTruthy();
  });
  it('recovers when the customer endpoint initially fails', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: 'Database unavailable.' }, { status: 503 }),
    );
    const user = userEvent.setup();
    render(<ThemeProvider><ChatWorkspace /></ThemeProvider>);
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Database unavailable'),
    );
    expect(
      (screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Retry connection' }));
    await screen.findByRole('option', { name: 'Maya Chen' });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
