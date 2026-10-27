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
  const [pageSize, setPageSize] = useState(8);
  const [sort, setSort] = useState("newest");
  useEffect(() => {
    setQuery("");
    setStatus("all");
    setPage(0);
  }, [data.customer.id]);
  const filtered = useMemo(
    () =>
      payments
        .filter(
          (payment) =>
            (status === "all" || payment.status === status) &&
            `${payment.merchant} ${payment.id} ${shortId(payment.id)}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "amount-high"
            ? b.amount_cents - a.amount_cents
            : sort === "amount-low"
              ? a.amount_cents - b.amount_cents
              : sort === "merchant"
                ? a.merchant.localeCompare(b.merchant)
                : sort === "oldest"
                  ? Date.parse(a.created_at) - Date.parse(b.created_at)
                  : Date.parse(b.created_at) - Date.parse(a.created_at),
        ),
    [payments, status, query, sort],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const rows = filtered.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize,
  );
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
        <div className="ledger-tools">
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
          <label className="ledger-sort">
            <span className="sr-only">Sort payments</span>
            <select
              aria-label="Sort payments"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(0);
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount-high">Amount: high to low</option>
              <option value="amount-low">Amount: low to high</option>
              <option value="merchant">Merchant A–Z</option>
            </select>
          </label>
        </div>
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
          <div className="empty-payments" role="status">
            <p>
              {payments.length
                ? "No payments match these filters."
                : "No payments recorded for this account yet."}
            </p>
            {payments.length > 0 && (
              <button
                className="soft-button"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                  setPage(0);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
      <div className="ledger-pagination">
        <span role="status">
          {filtered.length
            ? `Showing ${currentPage * pageSize + 1}–${Math.min(currentPage * pageSize + pageSize, filtered.length)} of ${filtered.length} payments`
            : "0 payments"}
        </span>
        <div>
          <label className="rows-control">
            Rows{" "}
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(0);
              }}
            >
              {[8, 15, 30].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
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
