import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createStore } from "../src/lib/db/queries";
import { demoId } from "../src/lib/demo/seed-data";
import { loadPaymentWorkspace } from "../src/lib/payments/store";
import { executeTool } from "../src/lib/tools/execute";
import { renderEvidenceAnswer } from "../src/lib/agent/evidence-answer";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error(
    "Database integration tests require a migrated and seeded Supabase database. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
const db = createClient(url, key, { auth: { persistSession: false } });
const store = createStore(db);

describe("migrated and seeded Supabase database", () => {
  const ids = [demoId(90000), demoId(90001), demoId(90002)];
  beforeAll(async () => {
    const customer = await store.customer(demoId(1));
    if (!customer)
      throw new Error("Run npm run db:seed before the database tests.");
  });
  afterAll(async () => {
    await db.from("transactions").delete().in("id", ids);
  });
  it("loads all 20 demo customers and 300 seeded transactions", async () => {
    expect(await store.customers()).toHaveLength(20);
    const { count, error } = await db
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .like("idempotency_key", "demo-payment-%");
    expect(error).toBeNull();
    expect(count).toBe(300);
  });
  it("loads a validated payment workspace with scoped methods and refund history", async () => {
    for (const id of [demoId(1), demoId(3), demoId(4)]) {
      const workspace = await loadPaymentWorkspace(id);
      expect(workspace?.customer.id).toBe(id);
      expect(
        workspace?.transactions.every((payment) => payment.customer_id === id),
      ).toBe(true);
      expect(
        workspace?.payment_methods.every((method) => method.customer_id === id),
      ).toBe(true);
      expect(
        workspace?.refunds.every((refund) =>
          workspace.transactions.some(
            (payment) => payment.id === refund.transaction_id,
          ),
        ),
      ).toBe(true);
    }
    expect(await loadPaymentWorkspace(demoId(999999))).toBeNull();
  });
  it("investigates duplicate charges and applies exact amount and date filters", async () => {
    const all = await store.search(demoId(1), { amount: 8499 });
    expect(all.transactions).toHaveLength(2);
    const time = all.transactions[0].created_at;
    const narrow = await store.search(demoId(1), {
      amount: 8499,
      date_range: { start: time, end: time },
    });
    expect(narrow.transactions).toHaveLength(1);
    expect(narrow.truncated).toBe(false);
  });
  it("returns pending and issued refunds and denies cross-customer reads", async () => {
    expect(
      (await store.transaction(demoId(3), demoId(1030)))?.refunds[0].status,
    ).toBe("pending");
    expect(
      (await store.transaction(demoId(4), demoId(1045)))?.refunds[0].status,
    ).toBe("succeeded");
    expect(await store.transaction(demoId(1), demoId(1030))).toBeNull();
    expect(
      await executeTool(
        "explain_decline_code",
        {
          code: (await store.transaction(demoId(2), demoId(1015)))!.transaction
            .decline_code,
        },
        demoId(2),
        store,
      ),
    ).toMatchObject({ known: true });
    expect(await store.policy("missing_refund")).toMatchObject({
      requires_approval: true,
    });
  });
  it("renders actual Neon refund evidence without granting a different account access", async () => {
    for (const [customer, transaction, status] of [[3, 1030, 'pending'], [4, 1045, 'succeeded']] as const) {
      const input = { transaction_id: demoId(transaction) };
      const result = await executeTool('get_transaction', input, demoId(customer), store);
      const policyInput = { reason: 'missing_refund' };
      const policyResult = await executeTool('get_refund_policy', policyInput, demoId(customer), store);
      const evidence = [{ name: 'get_transaction', input, result }, { name: 'get_refund_policy', input: policyInput, result: policyResult }];
      const answer = renderEvidenceAnswer(demoId(customer), evidence);
      expect(answer.complete).toBe(true);
      expect(answer.text).toContain(`**${status}**`);
      expect(answer.text).not.toContain('/approvals');
      expect(renderEvidenceAnswer(demoId(1), evidence).complete).toBe(false);
    }
  });
  it("enforces positive integer cents, valid statuses, ownership, and unique payment keys in Postgres", async () => {
    const base = {
      id: ids[0],
      customer_id: demoId(1),
      payment_method_id: demoId(100),
      amount_cents: 100,
      currency: "USD",
      status: "succeeded",
      merchant: "Integration test",
      idempotency_key: "integration-only-unique-key",
    };
    expect(
      (await db.from("transactions").insert({ ...base, amount_cents: 1.5 }))
        .error,
    ).not.toBeNull();
    expect(
      (await db.from("transactions").insert({ ...base, amount_cents: -100 }))
        .error?.code,
    ).toBe("23514");
    expect(
      (await db.from("transactions").insert({ ...base, status: "invented" }))
        .error?.code,
    ).toBe("23514");
    expect(
      (
        await db
          .from("transactions")
          .insert({ ...base, payment_method_id: demoId(101) })
      ).error?.code,
    ).toBe("23503");
    expect((await db.from("transactions").insert(base)).error).toBeNull();
    expect(
      (await db.from("transactions").insert({ ...base, id: ids[1] })).error
        ?.code,
    ).toBe("23505");
  });
  it("denies anonymous reads when an anonymous test key is supplied", async () => {
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!anonKey)
      throw new Error(
        "Set SUPABASE_ANON_KEY to validate row-level security (available from local Supabase status or the test harness).",
      );
    const anonymous = createClient(url!, anonKey, {
      auth: { persistSession: false },
    });
    for (const table of [
      "customers",
      "payment_methods",
      "transactions",
      "refunds",
      "refund_policies",
      "audit_log",
    ]) {
      const { data, error } = await anonymous.from(table).select("*").limit(1);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });
});
