"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { Transaction } from "@/lib/db/schemas";
import type { PaymentWorkspace } from "@/lib/payments/schemas";
import { money, paymentDate, shortId } from "@/lib/payments/ledger";

export function PaymentLedger({
  data,
  payments,
  onSelect,
}: {
  data: PaymentWorkspace;
  payments: Transaction[];
  onSelect: (payment: Transaction) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  useEffect(() => {
    setQuery("");
    setStatus("all");
    setPage(0);
  }, [data.customer.id]);
  const filtered = useMemo(
    () =>
      payments.filter(
        (payment) =>
          (status === "all" || payment.status === status) &&
          `${payment.merchant} ${payment.id} ${shortId(payment.id)}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [payments, status, query],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 4));
  const currentPage = Math.min(page, pages - 1);
  const rows = filtered.slice(currentPage * 4, currentPage * 4 + 4);
  return (
    <section
      className="payment-ledger surface-panel"
      aria-labelledby="ledger-heading"
    >
      <div className="panel-title">
        <h2 id="ledger-heading">
          Payment history <span className="count-badge">{payments.length}</span>
        </h2>
        <span>Payment dates in UTC</span>
      </div>
      <div className="ledger-controls">
        <div className="payment-tabs" aria-label="Payment status filters">
          {["all", "succeeded", "pending", "declined"].map((value) => (
            <button
              key={value}
              aria-pressed={status === value}
              onClick={() => {
                setStatus(value);
                setPage(0);
              }}
            >
              {value === "all"
                ? "All payments"
                : value[0].toUpperCase() + value.slice(1)}{" "}
              <span>
                {
                  payments.filter(
                    (payment) => value === "all" || payment.status === value,
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <label className="payment-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Search payments</span>
          <input
            value={query}
            type="search"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search payments…"
          />
        </label>
      </div>
      <div className="payment-table-wrap">
        <table className="payment-table">
          <thead>
            <tr>
              <th>Payment</th>
              <th>Status</th>
              <th className="numeric">Amount</th>
              <th>Method</th>
              <th>Created · UTC</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((payment) => {
              const method = data.payment_methods.find(
                (method) => method.id === payment.payment_method_id,
              );
              return (
                <tr key={payment.id}>
                  <td>
                    <button
                      className="payment-identity"
                      onClick={() => onSelect(payment)}
                    >
                      <span className="merchant-initials" aria-hidden="true">
                        {payment.merchant
                          .trim()
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((word) => Array.from(word)[0])
                          .join("")}
                      </span>
                      <span>
                        <strong>{payment.merchant}</strong>
                        <small>{shortId(payment.id)}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <span className={`payment-status ${payment.status}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="numeric">
                    {money(payment.amount_cents, payment.currency)}
                  </td>
                  <td>
                    {method ? (
                      <span className="method-name">
                        {method.brand} ···· {method.last4}
                      </span>
                    ) : (
                      "Unavailable"
                    )}
                  </td>
                  <td>
                    <span>{paymentDate(payment.created_at)}</span>
                    <small>
                      {new Intl.DateTimeFormat("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: "UTC",
                      }).format(new Date(payment.created_at))}
                    </small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <p className="empty-payments" role="status">
            {payments.length
              ? "No payments match these filters."
              : "No payments recorded for this account yet."}
          </p>
        )}
      </div>
      <div className="ledger-pagination">
        <span role="status">
          {filtered.length
            ? `Showing ${currentPage * 4 + 1}–${Math.min(currentPage * 4 + 4, filtered.length)} of ${filtered.length} payments`
            : "0 payments"}
        </span>
        <div>
          <button
            className="icon-button"
            aria-label="Previous payments"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span>
            {currentPage + 1} / {pages}
          </span>
          <button
            className="icon-button"
            aria-label="Next payments"
            disabled={currentPage >= pages - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
