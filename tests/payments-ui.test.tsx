// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "../src/components/ui/theme-provider";
import { PaymentDashboard } from "../src/components/payments/payment-dashboard";
import { INVESTIGATION_DRAFT_KEY } from "../src/components/payments/investigation-card";
import { paymentWorkspaceSchema } from "../src/lib/payments/schemas";
import { customers, transactions, seed } from "./helpers";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
function data(id: string) {
  return paymentWorkspaceSchema.parse({
    customer: customers.find((customer) => customer.id === id),
    transactions: transactions.filter(
      (transaction) => transaction.customer_id === id,
    ),
    payment_methods: seed.payment_methods.filter(
      (method) => method.customer_id === id,
    ),
    refunds: [],
    truncated: false,
    loaded_at: "2026-10-20T12:00:00Z",
  });
}
const fetchMock = vi.fn();
describe("payment dashboard", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    push.mockReset();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    fetchMock
      .mockReset()
      .mockImplementation(async (url: string) =>
        url === "/api/customers"
          ? Response.json({ customers })
          : Response.json(
              data(
                new URL(url, "https://example.test").searchParams.get(
                  "customer_id",
                )!,
              ),
            ),
      );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });
  it("loads scoped data, filters payments, and keeps every question unsent until review", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <PaymentDashboard />
      </ThemeProvider>,
    );
    await screen.findByRole("heading", { name: /welcome back, maya/i });
    expect(screen.getAllByText("Northstar Electronics")).toHaveLength(2);
    await user.type(
      screen.getByRole("searchbox", { name: "Search payments" }),
      "missing merchant",
    );
    expect(screen.getByText("No payments match these filters.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Double charge" }));
    const draft = JSON.parse(sessionStorage.getItem(INVESTIGATION_DRAFT_KEY)!);
    expect(draft.customer_id).toBe(customers[0].id);
    expect(draft.message).toContain("Northstar");
    expect(push).toHaveBeenCalledWith(`/demo?customer_id=${customers[0].id}`);
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/chat")).toBe(
      false,
    );
  });
  it("clears old account records on selection and reports a database error without seed fallback", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <PaymentDashboard />
      </ThemeProvider>,
    );
    await screen.findByRole("heading", { name: /welcome back, maya/i });
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/customers"
        ? Response.json({ customers })
        : Response.json(
            { error: "Account connection interrupted." },
            { status: 503 },
          ),
    );
    await user.selectOptions(
      screen.getByLabelText("Demo customer"),
      customers[1].id,
    );
    await screen.findByText("Account connection interrupted.");
    expect(screen.queryByText("Northstar Electronics")).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Payment history 15" }),
    ).toBeNull();
  });
});
