import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Transaction } from "@/lib/db/schemas";
import type { PaymentWorkspace } from "@/lib/payments/schemas";
import { money, summarizePayments } from "@/lib/payments/ledger";
export function AccountSummary({
  visible,
  payments,
  currency,
}: {
  visible: PaymentWorkspace;
  payments: Transaction[];
  currency: string;
}) {
  const summary = summarizePayments(payments);
  const firstMethod = visible.payment_methods[0];
  const pending = visible.refunds.filter(
    (refund) =>
      refund.currency === currency && refund.status === "pending_approval",
  ).length;
  return (
    <div className="payment-left-stack">
      <section className="account-card surface-panel">
        <h2>Account overview</h2>
        <p>
          {visible.truncated
            ? "Latest 50 payments · partial account view"
            : `${summary.count} loaded payments · ${currency}`}
        </p>
        <div className="virtual-payment-card">
          <div className="virtual-card-brand">
            <strong>{firstMethod?.brand || "Card"}</strong>
            <span>Demo account</span>
          </div>
          <span className="virtual-card-label">
            Successful payments · loaded records
          </span>
          <strong className="virtual-card-total">
            {money(summary.volume, currency)}
          </strong>
          <div className="virtual-card-footer">
            <span>
              {firstMethod ? `•••• ${firstMethod.last4}` : "No card on file"}
            </span>
            <span>{visible.customer.name}</span>
          </div>
        </div>
      </section>
      <section className="refund-summary surface-panel">
        <div>
          <h2>Awaiting approval</h2>
          <strong>{pending}</strong>
        </div>
        <Link href="/approvals">
          Human review <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
