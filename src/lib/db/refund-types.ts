import { z } from 'zod';
import { refundSchema, customerSchema, transactionSchema } from './schemas';

export const approvalSchema = refundSchema.extend({
  transaction: transactionSchema,
  customer: customerSchema,
});
export type Approval = z.infer<typeof approvalSchema>;
export const decisionSchema = z.strictObject({ decision: z.enum(['approve', 'reject']) });
