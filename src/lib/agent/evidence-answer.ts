import type { Refund, Transaction } from '../db/schemas';
import { toolSchemas, toolErrorSchema } from '../tools/definitions';
import { explainDecline } from '../tools/decline-codes';

export type AnswerEvidence = { name: string; input: unknown; result: unknown };
export const INCOMPLETE_ANSWER = 'The investigation is incomplete. A complete explanation could not be verified from the retrieved payment evidence. Review the recorded tool activity for any request already created.';
export const SCOPED_MISS = 'No matching payment was found in the selected account. Verify the payment ID and selected customer. This result does not establish whether the payment exists in another account.';

// Untrusted display fields are inline code, never Markdown links or instructions.
function data(value: string) {
  const clean = value.replace(/[\p{Cc}\p{Cf}]/gu, ' ');
  const text = clean.slice(0, 160) + (clean.length > 160 ? '… (truncated)' : '');
  const fence = '`'.repeat(Math.max(0, ...(text.match(/`+/g) ?? []).map(s => s.length)) + 1);
  return `${fence} ${text} ${fence}`;
}
function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount / 100);
}

/** Model prose is deliberately not an argument. Only scoped, validated tools count. */
export function renderEvidenceAnswer(customerId: string, evidence: readonly AnswerEvidence[]): { text: string; complete: boolean } {
  const payments = new Map<string, Transaction>();
  const detailed = new Set<string>();
  const refunds = new Map<string, Refund>();
  const requested = new Set<string>();
  const references = new Set<string>();
  const policies = new Map<string, number>();
  let miss = false, emptySearch = false, truncated = false, blocked = false, incomplete = false;
  const invalid = () => ({ text: INCOMPLETE_ANSWER, complete: false });
  function payment(row: Transaction) {
    if (row.customer_id !== customerId) return false;
    const previous = payments.get(row.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) return false;
    payments.set(row.id, row); return true;
  }
  function refund(row: Refund) {
    const previous = refunds.get(row.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) return false;
    refunds.set(row.id, row); return true;
  }
  for (const item of evidence) {
    if (!Object.hasOwn(toolSchemas, item.name)) { incomplete = true; continue; }
    const name = item.name as keyof typeof toolSchemas;
    const definition = toolSchemas[name];
    const input = definition.input.safeParse(item.input);
    if (!input.success) { incomplete = true; continue; }
    const error = toolErrorSchema.safeParse(item.result);
    if (error.success) {
      if (name === 'get_transaction' && error.data.error.code === 'NOT_FOUND') miss = true;
      else if (name === 'request_refund' && error.data.error.code === 'REFUND_BLOCKED') blocked = true;
      else incomplete = true;
      continue;
    }
    const result = definition.output.safeParse(item.result);
    if (!result.success) return invalid();
    switch (name) {
      case 'get_transaction': {
        const args = toolSchemas.get_transaction.input.parse(input.data);
        const row = toolSchemas.get_transaction.output.parse(result.data);
        if (row.transaction.id !== args.transaction_id || !payment(row.transaction)) return invalid();
        detailed.add(row.transaction.id);
        for (const r of row.refunds) if (r.transaction_id !== row.transaction.id || !refund(r)) return invalid();
        break;
      }
      case 'search_transactions': {
        const args = toolSchemas.search_transactions.input.parse(input.data);
        if (args.customer_id !== customerId) return invalid();
        const rows = toolSchemas.search_transactions.output.parse(result.data);
        for (const row of rows.transactions) if (!payment(row)) return invalid();
        emptySearch ||= rows.transactions.length === 0;
        truncated ||= rows.truncated;
        break;
      }
      case 'request_refund': {
        const args = toolSchemas.request_refund.input.parse(input.data);
        const row = toolSchemas.request_refund.output.parse(result.data).refund;
        if (row.transaction_id !== args.transaction_id || !refund(row)) return invalid();
        requested.add(row.id); break;
      }
      case 'explain_decline_code': {
        const args = toolSchemas.explain_decline_code.input.parse(input.data);
        const row = toolSchemas.explain_decline_code.output.parse(result.data);
        // Reference wording comes from the local reference, never arbitrary text.
        if (JSON.stringify(row) !== JSON.stringify(explainDecline(args.code))) return invalid();
        references.add(args.code); break;
      }
      case 'get_refund_policy': {
        const args = toolSchemas.get_refund_policy.input.parse(input.data);
        const row = toolSchemas.get_refund_policy.output.parse(result.data);
        if (row.reason !== args.reason || (policies.has(row.reason) && policies.get(row.reason) !== row.window_days)) return invalid();
        policies.set(row.reason, row.window_days); break;
      }
    }
  }
  for (const r of refunds.values()) {
    const p = payments.get(r.transaction_id);
    if (!p || p.status !== 'succeeded' || p.currency !== r.currency || r.amount_cents > p.amount_cents) return invalid();
  }
  for (const p of payments.values()) {
    const reserved = [...refunds.values()].filter(r => r.transaction_id === p.id && ['pending_approval', 'pending', 'succeeded'].includes(r.status)).reduce((sum, r) => sum + r.amount_cents, 0);
    if (reserved > p.amount_cents) return invalid();
  }
  if (!payments.size) {
    if ((miss || emptySearch) && !refunds.size && !incomplete) return { text: SCOPED_MISS, complete: true };
    return invalid();
  }
  // Searches discover candidates. Detail reads select the investigated records;
  // validate every discovered row above, but do not summarize unrelated candidates.
  const selected = detailed.size ? [...payments.values()].filter(p => detailed.has(p.id) || [...refunds.values()].some(r => r.transaction_id === p.id)) : [...payments.values()];
  const lines = ['**Recorded payment evidence**'];
  if (selected.length > 5 || (!detailed.size && truncated)) {
    lines.push('This is a limited view of retrieved records, not a complete account total.');
    incomplete = true;
  }
  for (const p of selected.slice(0, 5)) {
    lines.push(`Payment ${data(p.id)} — merchant ${data(p.merchant)}, ${money(p.amount_cents, p.currency)}; status **${p.status}**; recorded ${data(p.created_at)}.`);
    if (p.status === 'pending') lines.push('This payment has not settled. A refund cannot be requested while the payment is pending. Check its status again before considering a refund.');
    if (p.status === 'declined') {
      lines.push('The payment was declined and did not settle; it is not eligible for a refund.');
      if (p.decline_code && references.has(p.decline_code)) {
        const ref = explainDecline(p.decline_code);
        lines.push(`Recorded decline code: ${data(p.decline_code)}. ${ref.meaning} ${ref.suggested_action}`);
      } else {
        lines.push('The decline reference was not verified. Contact the issuing bank for clarification; no specific bank reason is inferred.');
        incomplete = true;
      }
    }
    const records = [...refunds.values()].filter(r => r.transaction_id === p.id);
    if (p.status === 'succeeded' && detailed.has(p.id)) {
      const reserved = records.filter(r => ['pending_approval', 'pending', 'succeeded'].includes(r.status)).reduce((sum, r) => sum + r.amount_cents, 0);
      lines.push(`Unrefunded, unreserved balance: ${money(p.amount_cents - reserved, p.currency)}. A refund request cannot exceed this balance. Eligibility rules and human approval still apply.`);
    }
    if (detailed.has(p.id) && !records.length) lines.push('No refund records were returned for this payment.');
    if (!detailed.has(p.id)) { lines.push('Refund history was not retrieved for this payment.'); incomplete = true; }
    if (records.length > 5) { lines.push('Additional refund records are not shown in this summary.'); incomplete = true; }
    for (const r of records.slice(0, 5)) {
      lines.push(`${requested.has(r.id) ? 'Refund request record' : 'Existing refund'} ${data(r.id)} — ${money(r.amount_cents, r.currency)}; status **${r.status}**.`);
      switch (r.status) {
        case 'pending_approval': lines.push(`Awaiting a human decision; it has not been issued. [Review this request](/approvals#refund-${r.id}).`); break;
        case 'pending': lines.push('This refund is processing, not awaiting human approval. Do not request the same refunded amount again.'); break;
        case 'succeeded': lines.push('This refund is completed in the mock ledger. That does not confirm receipt by a bank. Do not issue it again.'); break;
        case 'rejected': lines.push('The reviewer rejected this request; it was not issued. No rejection reason is inferred. Review the recorded decision before considering another request.'); break;
        case 'failed': lines.push('This refund did not complete. Review its recorded failure before considering another request; no replacement or support ticket is created by this summary.'); break;
      }
      if (r.status === 'pending' && policies.has('missing_refund')) lines.push(`Recorded missing-refund policy window: ${policies.get('missing_refund')} days. This is not a guaranteed bank posting date.`);
      const hasPolicy = requested.has(r.id) ? policies.size > 0 : policies.has('missing_refund') || policies.has('other');
      if (!hasPolicy) { lines.push('The applicable refund policy was not retrieved.'); incomplete = true; }
    }
  }
  const rows = selected;
  if (rows.some((p, i) => rows.slice(i + 1).some(q => p.status === 'succeeded' && q.status === 'succeeded' && p.merchant === q.merchant && p.amount_cents === q.amount_cents && p.currency === q.currency && Math.abs(Date.parse(p.created_at) - Date.parse(q.created_at)) <= 300_000)))
    lines.push('Matching charges are a signal, not proof of a duplicate purchase.');
  if (miss || emptySearch) lines.push('At least one scoped lookup found no matching payment; no conclusion about other accounts is possible.');
  if (blocked) lines.push('A refund request was blocked by the eligibility rules. That attempt did not confirm a new refund request; existing records are shown above.');
  // Only assert no new request when no mutation tool was attempted. A failed
  // request may have an uncertain outcome; never infer absence from an error.
  if (!evidence.some(item => item.name === 'request_refund'))
    lines.push('No new refund request was created during this investigation.');
  if (incomplete) lines.push(INCOMPLETE_ANSWER);
  return { text: lines.join('\n\n'), complete: !incomplete };
}
