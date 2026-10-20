// @vitest-environment jsdom
import React from 'react';
import { ThemeProvider } from '../src/components/ui/theme-provider';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApprovalQueue } from '../src/components/approvals/approval-queue';
import { customers, transactions, refunds } from './helpers';

const approval = { ...refunds[0], status: 'pending_approval', transaction_id: transactions[0].id,
  reason: 'Two matching successful charges, two minutes apart.', transaction: transactions[0], customer: customers[0] };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('human approval queue', () => {
  it.each(['Approve mock refund', 'Reject'])('shows evidence and submits %s once before removing the request', async (label) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ refunds: [approval] }))
      .mockResolvedValueOnce(Response.json({ refund: { ...approval, status: label === 'Reject' ? 'rejected' : 'succeeded' } }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<ThemeProvider><ApprovalQueue /></ThemeProvider>);
    expect(await screen.findByText(approval.reason)).toBeTruthy();
    expect(screen.getByText(/Maya Chen/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: label }));
    expect(await screen.findByText('No refunds awaiting review')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ decision: label === 'Reject' ? 'reject' : 'approve' });
    expect(screen.getByRole('status').textContent).toContain(label === 'Reject' ? 'rejected' : 'No real money moved');
  });
  it('keeps the request visible and offers refresh when a decision cannot be confirmed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ refunds: [approval] }))
      .mockResolvedValueOnce(Response.json({ error: 'A different decision already exists. Refresh the queue.' }, { status: 409 })));
    const user = userEvent.setup();
    render(<ThemeProvider><ApprovalQueue /></ThemeProvider>);
    await user.click(await screen.findByRole('button', { name: 'Approve mock refund' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Refresh the queue'));
    expect(screen.getByText(approval.reason)).toBeTruthy();
  });
});
