import "server-only";
import { z } from "zod";
import type { DatabaseClient } from "./client";
import {
  customerSchema,
  transactionSchema,
  refundSchema,
  policySchema,
} from "./schemas";
import { createRefundStore } from "./refunds";
import { AuditUnavailableError } from "./audit";
import type { Customer, Transaction, Refund, RefundPolicy } from "./schemas";

export type SearchFilters = {
  amount?: number;
  date_range?: { start: string; end: string };
};
export interface DisputeStore {
  requestRefund: ReturnType<typeof createRefundStore>["request"];
  audit(entry: {
    run_id: string;
    actor: "agent" | "system";
    action: string;
    customer_id: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
  customers(): Promise<Customer[]>;
  customer(id: string): Promise<Customer | null>;
  search(
    customerId: string,
    filters: SearchFilters,
  ): Promise<{ transactions: Transaction[]; truncated: boolean }>;
  transaction(
    customerId: string,
    id: string,
  ): Promise<{ transaction: Transaction; refunds: Refund[] } | null>;
  policy(reason: string): Promise<RefundPolicy | null>;
}

const transactionFields =
  "id,customer_id,payment_method_id,amount_cents,currency,status,merchant,created_at,decline_code";

export function createStore(db: DatabaseClient): DisputeStore {
  return {
    requestRefund: createRefundStore(db).request,
    async audit(entry) {
      const { error } = await db.from("audit_log").insert(entry);
      if (error) throw new AuditUnavailableError();
    },
    async customers() {
      const { data, error } = await db
        .from("customers")
        .select("id,name,email,is_demo")
        .eq("is_demo", true)
        .order("name");
      if (error)
        throw new Error(
          "Could not load demo customers. Check the database connection and apply the migration and seed.",
        );
      return z.array(customerSchema).parse(data);
    },
    async customer(id) {
      const { data, error } = await db
        .from("customers")
        .select("id,name,email,is_demo")
        .eq("id", id)
        .eq("is_demo", true)
        .maybeSingle();
      if (error)
        throw new Error("Could not verify the selected demo customer.");
      return data ? customerSchema.parse(data) : null;
    },
    async search(customerId, filters) {
      let query = db
        .from("transactions")
        .select(transactionFields)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .order("id")
        .limit(51);
      if (filters.amount !== undefined)
        query = query.eq("amount_cents", filters.amount);
      if (filters.date_range)
        query = query
          .gte("created_at", filters.date_range.start)
          .lte("created_at", filters.date_range.end);
      const { data, error } = await query;
      if (error)
        throw new Error(
          "Transaction search failed. Try again or narrow the search.",
        );
      const transactions = z.array(transactionSchema).parse(data);
      return {
        transactions: transactions.slice(0, 50),
        truncated: transactions.length > 50,
      };
    },
    async transaction(customerId, id) {
      const { data, error } = await db
        .from("transactions")
        .select(transactionFields)
        .eq("customer_id", customerId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error("Could not retrieve that transaction.");
      if (!data) return null;
      const { data: refunds, error: refundError } = await db
        .from("refunds")
        .select(
          "id,transaction_id,amount_cents,currency,status,reason,created_at,updated_at",
        )
        .eq("transaction_id", id)
        .order("created_at");
      if (refundError)
        throw new Error(
          "Could not retrieve the refund history for that transaction.",
        );
      return {
        transaction: transactionSchema.parse(data),
        refunds: z.array(refundSchema).parse(refunds),
      };
    },
    async policy(reason) {
      const { data, error } = await db
        .from("refund_policies")
        .select("reason,description,window_days,requires_approval")
        .eq("reason", reason)
        .maybeSingle();
      if (error) throw new Error("Could not retrieve the refund policy.");
      return data ? policySchema.parse(data) : null;
    },
  };
}
