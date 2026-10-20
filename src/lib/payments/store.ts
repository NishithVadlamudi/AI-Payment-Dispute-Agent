import "server-only";
import { z } from "zod";
import { createDatabaseClient } from "../db/client";
import { createStore } from "../db/queries";
import { refundSchema } from "../db/schemas";
import { paymentMethodSchema, paymentWorkspaceSchema } from "./schemas";

export async function loadPaymentWorkspace(customerId: string) {
  const db = createDatabaseClient();
  const store = createStore(db);
  const customer = await store.customer(customerId);
  if (!customer) return null;
  const [result, { data: methods, error: methodError }] = await Promise.all([
    store.search(customer.id, {}),
    db
      .from("payment_methods")
      .select("id,customer_id,type,brand,last4")
      .eq("customer_id", customer.id),
  ]);
  if (methodError) throw new Error("Payment methods could not be loaded.");
  const ids = result.transactions.map((transaction) => transaction.id);
  const refunds = ids.length
    ? await db
        .from("refunds")
        .select(
          "id,transaction_id,amount_cents,currency,status,reason,created_at,updated_at",
        )
        .in("transaction_id", ids)
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (refunds.error) throw new Error("Refund history could not be loaded.");
  return paymentWorkspaceSchema.parse({
    customer,
    ...result,
    payment_methods: z.array(paymentMethodSchema).parse(methods),
    refunds: z.array(refundSchema).parse(refunds.data),
    loaded_at: new Date().toISOString(),
  });
}
