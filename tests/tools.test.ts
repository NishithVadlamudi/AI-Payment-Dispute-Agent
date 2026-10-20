import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeTool } from '../src/lib/tools/execute';
import { RefundError } from '../src/lib/db/refunds';
import { tools } from '../src/lib/tools/definitions';
import { fakeStore, customers, transactions } from './helpers';

describe('validated read-only tools', () => {
  let store = fakeStore();
  const customerId = customers[0].id;
  beforeEach(() => {
    store = fakeStore();
  });
  const search = (input: unknown) => executeTool('search_transactions', input, customerId, store);

  it('exposes five strict native function schemas', () => {
    expect(tools).toHaveLength(5);
    for (const tool of tools) {
      expect(tool.strict).toBe(true);
      expect(tool.parameters?.additionalProperties).toBe(false);
      expect(tool.description?.length).toBeGreaterThan(50);
    }
  });
  it('finds both matching charges using exact integer cents', async () => {
    const result = await search({ customer_id: customerId, amount: 8499, date_range: null });
    expect('transactions' in result && result.transactions).toHaveLength(2);
    expect(store.search).toHaveBeenCalledWith(customerId, { amount: 8499, date_range: undefined });
  });
  it.each([84.99, -1, 0, 2_147_483_648, '8499'])(
    'rejects invalid amount %s before querying',
    async (amount) => {
      expect(await search({ customer_id: customerId, amount, date_range: null })).toMatchObject({
        error: { code: 'INVALID_INPUT' },
      });
      expect(store.search).not.toHaveBeenCalled();
    },
  );
  it('rejects invalid and reversed dates', async () => {
    for (const date_range of [
      { start: 'yesterday', end: 'today' },
      { start: '2026-10-16T00:00:00Z', end: '2026-10-15T00:00:00Z' },
    ]) {
      expect(await search({ customer_id: customerId, amount: null, date_range })).toMatchObject({
        error: { code: 'INVALID_INPUT' },
      });
    }
    expect(store.search).not.toHaveBeenCalled();
  });
  it('rejects another customer instead of trusting the model', async () => {
    expect(
      await search({ customer_id: customers[1].id, amount: null, date_range: null }),
    ).toMatchObject({ error: { code: 'CUSTOMER_MISMATCH' } });
    expect(store.search).not.toHaveBeenCalled();
  });
  it('cannot retrieve another customer’s transaction by guessing an ID', async () => {
    expect(
      await executeTool(
        'get_transaction',
        { transaction_id: transactions[15].id },
        customerId,
        store,
      ),
    ).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
  it('returns pending and already issued refunds with transaction details', async () => {
    for (const [customerIndex, transactionIndex, status] of [
      [2, 30, 'pending'],
      [3, 45, 'succeeded'],
    ] as const) {
      const result = await executeTool(
        'get_transaction',
        { transaction_id: transactions[transactionIndex].id },
        customers[customerIndex].id,
        store,
      );
      expect('refunds' in result && result.refunds[0].status).toBe(status);
    }
  });
  it('explains known declines and explicitly identifies unknown codes', async () => {
    expect(
      await executeTool('explain_decline_code', { code: 'insufficient_funds' }, customerId, store),
    ).toMatchObject({ known: true, meaning: expect.stringContaining('insufficient') });
    expect(
      await executeTool('explain_decline_code', { code: 'new_bank_code' }, customerId, store),
    ).toMatchObject({ known: false });
    expect(
      await executeTool('explain_decline_code', { code: '__proto__' }, customerId, store),
    ).toMatchObject({ known: false });
  });
  it('returns the approval requirement in the refund policy', async () => {
    expect(
      await executeTool('get_refund_policy', { reason: 'duplicate_charge' }, customerId, store),
    ).toMatchObject({ requires_approval: true });
  });
  it.each(['approve_refund', 'toString', '__proto__'])(
    'rejects unavailable tool %s',
    async (name) => {
      expect(await executeTool(name, {}, customerId, store)).toMatchObject({
        error: { code: 'UNKNOWN_TOOL' },
      });
    },
  );
  it('returns refund rule failures to the model and audits invalid requests', async () => {
    vi.mocked(store.requestRefund).mockRejectedValue(new RefundError('REFUND_EXCEEDS_AVAILABLE'));
    expect(await executeTool('request_refund', { transaction_id: transactions[0].id, amount_cents: 9000, reason: 'Duplicate payment' }, customerId, store)).toMatchObject({ error: { code: 'REFUND_BLOCKED', message: expect.stringContaining('remaining balance') } });
    for (const amount_cents of [1.5, 0, -1, 2_147_483_648]) {
      expect(await executeTool('request_refund', { transaction_id: transactions[0].id, amount_cents, reason: 'Duplicate payment' }, customerId, store)).toMatchObject({ error: { code: 'INVALID_INPUT' } });
    }
    expect(store.requestRefund).toHaveBeenCalledTimes(1);
    expect(store.audit).toHaveBeenCalledTimes(10);
  });
  it('reports database failures without exposing their raw payload', async () => {
    vi.mocked(store.search).mockRejectedValue(new Error('sensitive database details'));
    const result = await search({ customer_id: customerId, amount: null, date_range: null });
    expect(result).toMatchObject({ error: { code: 'TOOL_FAILED' } });
    expect(JSON.stringify(result)).not.toContain('sensitive');
  });
  it('validates outputs and prevents a faulty store from returning another customer’s records', async () => {
    vi.mocked(store.search).mockResolvedValue({
      transactions: [transactions[15]],
      truncated: false,
    });
    expect(await search({ customer_id: customerId, amount: null, date_range: null })).toMatchObject(
      { error: { code: 'TOOL_FAILED' } },
    );
    vi.mocked(store.search).mockResolvedValue({
      transactions: [{ ...transactions[0], amount_cents: 84.99 }],
      truncated: false,
    });
    expect(await search({ customer_id: customerId, amount: null, date_range: null })).toMatchObject(
      { error: { code: 'TOOL_FAILED' } },
    );
  });
});
