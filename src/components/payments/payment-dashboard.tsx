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
import { duplicateCandidates, paymentCsv } from "@/lib/payments/ledger";
import { WorkspaceShell } from "../ui/workspace-shell";
import { InvestigationCard } from "./investigation-card";
import { PaymentLedger } from "./payment-ledger";
import { VolumeChart } from "./volume-chart";
import { PaymentDetail } from "./payment-detail";
import { AccountSummary } from "./account-summary";
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
            <p>Your payment activity, with answers when something looks off.</p>
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
            <Link className="green-button" href="/demo">
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
            <div className="payment-grid">
              <AccountSummary
                visible={visible}
                payments={payments}
                currency={currency}
              />
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
