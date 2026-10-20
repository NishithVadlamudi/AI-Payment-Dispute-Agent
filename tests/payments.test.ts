import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  money,
  duplicateCandidates,
  dailyVolume,
  shortId,
  paymentCsv,
} from "../src/lib/payments/ledger";
import { paymentWorkspaceSchema } from "../src/lib/payments/schemas";
import { loadPaymentWorkspace } from "../src/lib/payments/store";
import { GET } from "../src/app/api/payments/route";
import { customers, transactions, seed } from "./helpers";

vi.mock("../src/lib/payments/store", () => ({ loadPaymentWorkspace: vi.fn() }));
const scoped = transactions.filter(
  (transaction) => transaction.customer_id === customers[0].id,
);
const workspace = () =>
  paymentWorkspaceSchema.parse({
    customer: customers[0],
    transactions: scoped,
    payment_methods: seed.payment_methods.filter(
      (method) => method.customer_id === customers[0].id,
    ),
    refunds: [],
    truncated: false,
    loaded_at: "2026-10-20T12:00:00Z",
  });

describe("payment workspace boundaries", () => {
  beforeEach(() => {
    vi.mocked(loadPaymentWorkspace).mockReset();
  });
  it("rejects payment and method records from another customer", () => {
    const data = workspace();
    expect(() =>
      paymentWorkspaceSchema.parse({
        ...data,
        transactions: [
          transactions.find(
            (transaction) => transaction.customer_id !== customers[0].id,
          ),
        ],
      }),
    ).toThrow();
    expect(() =>
      paymentWorkspaceSchema.parse({
        ...data,
        payment_methods: [
          seed.payment_methods.find(
            (method) => method.customer_id !== customers[0].id,
          ),
        ],
      }),
    ).toThrow();
  });
  it("requires exactly one valid customer ID and rejects unknown query fields", async () => {
    for (const query of [
      "",
      "customer_id=bad",
      `customer_id=${customers[0].id}&customer_id=${customers[1].id}`,
      `customer_id=${customers[0].id}&include_all=true`,
    ]) {
      expect(
        (await GET(new Request(`https://example.test/api/payments?${query}`)))
          .status,
      ).toBe(400);
    }
    expect(loadPaymentWorkspace).not.toHaveBeenCalled();
  });
  it("returns only the scoped loader result and prevents caching", async () => {
    vi.mocked(loadPaymentWorkspace).mockResolvedValue(workspace());
    const response = await GET(
      new Request(
        `https://example.test/api/payments?customer_id=${customers[0].id}`,
      ),
    );
    expect(loadPaymentWorkspace).toHaveBeenCalledWith(customers[0].id);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(
      (await response.json()).transactions.every(
        (transaction: { customer_id: string }) =>
          transaction.customer_id === customers[0].id,
      ),
    ).toBe(true);
  });
  it("returns a clear missing-account or database failure without exposing exceptions", async () => {
    vi.mocked(loadPaymentWorkspace).mockResolvedValue(null);
    expect(
      (
        await GET(
          new Request(
            `https://example.test/api/payments?customer_id=${customers[0].id}`,
          ),
        )
      ).status,
    ).toBe(404);
    vi.mocked(loadPaymentWorkspace).mockRejectedValue(
      new Error("private database connection details"),
    );
    const response = await GET(
      new Request(
        `https://example.test/api/payments?customer_id=${customers[0].id}`,
      ),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database");
  });
});
describe("payment presentation rules", () => {
  it("only marks successful charges of the same customer, currency, merchant and amount within five minutes", () => {
    const base = scoped[0];
    const pair = {
      ...base,
      id: "pair",
      created_at: new Date(Date.parse(base.created_at) + 120000).toISOString(),
    };
    expect(duplicateCandidates([base, pair])).toHaveLength(2);
    for (const changed of [
      { currency: "EUR" },
      { status: "declined" as const },
      { customer_id: customers[1].id },
      { merchant: "Other" },
      { amount_cents: base.amount_cents + 1 },
      {
        created_at: new Date(
          Date.parse(base.created_at) + 301000,
        ).toISOString(),
      },
    ])
      expect(duplicateCandidates([base, { ...pair, ...changed }])).toHaveLength(
        0,
      );
  });
  it("keeps cents precise, IDs distinguishable, and UTC chart totals consistent", () => {
    expect(money(8499)).toBe("$84.99");
    expect(shortId(scoped[0].id)).not.toBe(shortId(scoped[1].id));
    const days = dailyVolume(scoped, "2026-10-16T01:00:00Z");
    expect(days).toHaveLength(14);
    expect(days.reduce((sum, day) => sum + day.cents, 0)).toBe(
      scoped
        .filter(
          (transaction) =>
            transaction.status === "succeeded" &&
            transaction.created_at.slice(0, 10) >= days[0].date &&
            transaction.created_at.slice(0, 10) <= days.at(-1)!.date,
        )
        .reduce((sum, transaction) => sum + transaction.amount_cents, 0),
    );
  });
  it("quotes merchant commas and line breaks and neutralizes spreadsheet formulas", () => {
    const csv = paymentCsv([
      { ...scoped[0], merchant: '=HYPERLINK("bad"),\nmerchant' },
    ]);
    expect(csv).toContain('"\'=HYPERLINK(""bad""),\nmerchant"');
    expect(csv).toContain(String(scoped[0].amount_cents));
  });
});
