import { z } from 'zod';

export const cents = z.number().int().positive().max(2_147_483_647);
export const currency = z.string().regex(/^[A-Z]{3}$/);
export const customerSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  is_demo: z.literal(true),
});
export const refundSchema = z.object({
  id: z.uuid(),
  transaction_id: z.uuid(),
  amount_cents: cents,
  currency,
  status: z.enum(['pending_approval', 'pending', 'succeeded', 'rejected', 'failed']),
  reason: z.string(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export const transactionSchema = z.object({
  id: z.uuid(),
  customer_id: z.uuid(),
  payment_method_id: z.uuid(),
  amount_cents: cents,
  currency,
  status: z.enum(['pending', 'succeeded', 'declined']),
  merchant: z.string(),
  created_at: z.iso.datetime({ offset: true }),
  decline_code: z.string().nullable(),
});
export const policySchema = z.object({
  reason: z.string(),
  description: z.string(),
  window_days: z.number().int().positive(),
  requires_approval: z.literal(true),
});
export type Customer = z.infer<typeof customerSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Refund = z.infer<typeof refundSchema>;
export type RefundPolicy = z.infer<typeof policySchema>;
