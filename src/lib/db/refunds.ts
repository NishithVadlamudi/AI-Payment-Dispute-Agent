import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { refundSchema } from './schemas';
import { approvalSchema } from './refund-types';
export { decisionSchema } from './refund-types';

const messages: Record<string, string> = {
  REFUND_NOT_FOUND: 'That refund or transaction was not found in the selected demo account.',
  REFUND_INVALID_INPUT: 'Provide a positive integer amount in cents and a clear refund reason.',
  REFUND_KEY_CONFLICT: 'This request key was already used with different refund details.',
  REFUND_NOT_SETTLED:
    'Only succeeded payments can be refunded. Declined and pending payments cannot be refunded.',
  REFUND_ALREADY_REQUESTED:
    'A different refund amount is already awaiting review for this payment.',
  REFUND_EXCEEDS_AVAILABLE:
    'The refund exceeds the remaining balance after existing refunds and outstanding requests.',
  REFUND_DECISION_CONFLICT:
    'This refund already has a different decision or is not awaiting approval. Refresh the queue.',
};

export class RefundError extends Error {
  constructor(public readonly code: string) {
    super(messages[code] ?? 'The refund operation could not be completed. Please try again.');
  }
}

function checkRefundError(error: { message: string } | null) {
  if (error)
    throw new RefundError(
      Object.hasOwn(messages, error.message) ? error.message : 'REFUND_UNAVAILABLE',
    );
}

type RefundRequest = { transaction_id: string; amount_cents: number; reason: string };

export function createRefundStore(db: SupabaseClient) {
  return {
    async request(customerId: string, args: RefundRequest, key: string, runId: string) {
      const { data, error } = await db.rpc('request_demo_refund', {
        p_customer_id: customerId,
        p_transaction_id: args.transaction_id,
        p_amount_cents: args.amount_cents,
        p_reason: args.reason,
        p_idempotency_key: key,
        p_run_id: runId,
      });
      checkRefundError(error);
      return refundSchema.parse(data);
    },
    async decide(id: string, decision: 'approve' | 'reject') {
      const { data, error } = await db.rpc('decide_demo_refund', {
        p_refund_id: id,
        p_decision: decision,
      });
      checkRefundError(error);
      return refundSchema.parse(data);
    },
    async queue() {
      const { data, error } = await db
        .from('refunds')
        .select('*,transaction:transactions!inner(*,customer:customers!inner(id,name,email,is_demo))')
        .eq('status', 'pending_approval')
        .eq('transaction.customer.is_demo', true)
        .order('created_at')
        .limit(100);
      if (error) throw new RefundError('REFUND_UNAVAILABLE');
      return z.array(approvalSchema).parse(
        data.map((row) => ({ ...row, customer: row.transaction.customer })),
      );
    },
  };
}
