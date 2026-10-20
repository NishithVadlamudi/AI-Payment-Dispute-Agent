import { z } from "zod";
import { customerSchema, transactionSchema, refundSchema } from "../db/schemas";

export const paymentMethodSchema = z.object({
  id: z.uuid(),
  customer_id: z.uuid(),
  type: z.literal("card"),
  brand: z.string(),
  last4: z.string().regex(/^\d{4}$/),
});
export const paymentWorkspaceSchema = z
  .object({
    customer: customerSchema,
    transactions: z.array(transactionSchema).max(50),
    payment_methods: z.array(paymentMethodSchema),
    refunds: z.array(refundSchema),
    truncated: z.boolean(),
    loaded_at: z.iso.datetime({ offset: true }),
  })
  .superRefine((data, context) => {
    const ids = new Set(data.transactions.map((transaction) => transaction.id));
    if (
      data.transactions.some(
        (transaction) => transaction.customer_id !== data.customer.id,
      ) ||
      data.payment_methods.some(
        (method) => method.customer_id !== data.customer.id,
      ) ||
      data.refunds.some((refund) => !ids.has(refund.transaction_id))
    )
      context.addIssue({
        code: "custom",
        message: "Payment records do not match the selected account.",
      });
  });
export type PaymentWorkspace = z.infer<typeof paymentWorkspaceSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
