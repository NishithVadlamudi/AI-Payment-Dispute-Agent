"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Download,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { Transaction } from "@/lib/db/schemas";
import {
  duplicateCandidates,
  paymentCsv,
  summarizePayments,
  money,
} from "@/lib/payments/ledger";
import { WorkspaceShell } from "../ui/workspace-shell";
import { InvestigationCard } from "./investigation-card";
import { PaymentLedger } from "./payment-ledger";
import { VolumeChart } from "./volume-chart";
import { PaymentDetail } from "./payment-detail";
import { MatchingPayments } from "./matching-payments";
import { usePaymentWorkspace } from "./use-payment-workspace";

export function PaymentDashboard() {
  const {
    customers,
    customerId,
    setCustomerId,
    data,
    loading,
    error,
    currency,
    setCurrency,
    refresh,
  } = usePaymentWorkspace();
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [contextPayment, setContextPayment] = useState<Transaction | null>(
    null,
  );
  useEffect(() => {
    setContextPayment(null);
    setDetail(null);
  }, [customerId, currency]);
  function openDetail(payment: Transaction) {
    setDetail(payment);
  }
  function exportPayments() {
    if (!data) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          "\uFEFF" +
            paymentCsv(
              data.transactions.filter(
                (payment) => payment.currency === currency,
              ),
            ),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `resolve-payments-${currency}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const visible = data?.customer.id === customerId ? data : null;
  const payments =
    visible?.transactions.filter((payment) => payment.currency === currency) ||
    [];
  const matches = duplicateCandidates(payments);
  const summary = summarizePayments(payments);
  const pendingApprovals =
    visible?.refunds.filter(
      (refund) =>
        refund.currency === currency && refund.status === "pending_approval",
    ).length || 0;
  const currencies = [
    ...new Set(visible?.transactions.map((payment) => payment.currency)),
  ];
  const end =
    payments
      .map((payment) => payment.created_at)
      .sort()
      .at(-1) ||
    visible?.loaded_at ||
    new Date().toISOString();

  return (
    <WorkspaceShell active="payments">
      <main id="main-content" className="payments-main">
        <div className="payments-heading">
          <div>
            <span className="workspace-eyebrow">YOUR PAYMENT WORKSPACE</span>
            <h1>
              Welcome back
              {visible ? (
                <>
                  , <span>{visible.customer.name.split(" ")[0]}.</span>
                </>
              ) : (
                "."
              )}
            </h1>
            <p>
              Every payment in view. A clear next step when something looks off.
            </p>
          </div>
          <div className="payments-actions">
            <button
              className="soft-button"
              onClick={refresh}
              disabled={loading}
              aria-label="Refresh payments"
            >
              <RefreshCw size={15} aria-hidden="true" />
              <span>Refresh</span>
            </button>
            <button
              className="soft-button"
              onClick={exportPayments}
              disabled={!visible || loading}
            >
              <Download size={15} aria-hidden="true" />
              <span>Export</span>
            </button>
            <Link
              className="green-button"
              href={
                customerId
                  ? `/demo?customer_id=${encodeURIComponent(customerId)}`
                  : "/demo"
              }
            >
              Investigate <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="account-controls">
          <label htmlFor="dashboard-customer">
            Demo customer
            <select
              id="dashboard-customer"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              disabled={!customers.length}
            >
              {!customers.length && (
                <option value="">No accounts loaded</option>
              )}
              {customers.map((customer) => (
                <option value={customer.id} key={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          {currencies.length > 1 && (
            <label htmlFor="dashboard-currency">
              Currency
              <select
                id="dashboard-currency"
                value={currency}
                onChange={(event) => {
                  setCurrency(event.target.value);
                  setContextPayment(null);
                }}
              >
                {currencies.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
          <span className="account-scope">
            <ShieldCheck size={14} aria-hidden="true" />
            Fictional payments · selected account only
          </span>
        </div>
        {error && (
          <div className="payment-error" role="alert">
            <strong>Payments are unavailable</strong>
            <p>{error}</p>
            <button className="soft-button" onClick={refresh}>
              Retry connection
            </button>
          </div>
        )}
        {loading && (
          <div className="payment-loading" role="status">
            <LoaderCircle size={20} className="spin" aria-hidden="true" />
            Loading this account’s payments…
          </div>
        )}
        {visible && !loading && !error && (
          <>
            <div
              className="payment-metrics"
              aria-label="Account summary metrics"
            >
              <div className="metric-card">
                <span>Successful payment volume</span>
                <strong>{money(summary.volume, currency)}</strong>
                <small>{currency} · loaded account records</small>
              </div>
              <div className="metric-card">
                <span>Payments</span>
                <strong>
                  {summary.count}
                  <small className="metric-inline">total</small>
                </strong>
                <small>
                  {summary.succeeded} succeeded · {summary.declined} declined
                </small>
              </div>
              <Link className="metric-card actionable-metric" href="/approvals">
                <span>
                  Awaiting your review{" "}
                  <ArrowRight size={14} aria-hidden="true" />
                </span>
                <strong>{pendingApprovals}</strong>
                <small>Refunds always need human approval</small>
              </Link>
              <button
                className="metric-card actionable-metric"
                disabled={!matches.length}
                onClick={() => openDetail(matches[0])}
              >
                <span>
                  Matching charges <ArrowRight size={14} aria-hidden="true" />
                </span>
                <strong>
                  {matches.length}
                  <small className="metric-inline">to review</small>
                </strong>
                <small>
                  {matches.length
                    ? "Inspect the evidence before deciding"
                    : "No matching charges in this account"}
                </small>
              </button>
            </div>
            <div className="payment-grid">
              <VolumeChart payments={payments} currency={currency} end={end} />
              <PaymentLedger
                key={`${customerId}-${currency}`}
                data={visible}
                payments={payments}
                onSelect={openDetail}
              />
              <aside className="payment-right-stack">
                <InvestigationCard
                  key={customerId}
                  customerId={customerId}
                  payment={contextPayment}
                  onRemovePayment={() => setContextPayment(null)}
                />
                <MatchingPayments matches={matches} onSelect={openDetail} />
              </aside>
            </div>
            <footer className="payment-footer">
              <span>
                {visible.truncated ? "Partial view: latest 50 records. " : ""}
                Loaded{" "}
                {new Intl.DateTimeFormat("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "UTC",
                }).format(new Date(visible.loaded_at))}{" "}
                UTC · Mock payments only
              </span>
              <Link href="/under-the-hood">
                Activity & evaluations{" "}
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </footer>
          </>
        )}
        <PaymentDetail
          detail={detail}
          matches={matches}
          visible={visible}
          onAttach={setContextPayment}
          onClose={() => setDetail(null)}
        />
      </main>
    </WorkspaceShell>
  );
}
