"use client";
import { useEffect, useRef } from "react";
import { ArrowRight, X } from "lucide-react";
import type { Transaction } from "@/lib/db/schemas";
import type { PaymentWorkspace } from "@/lib/payments/schemas";
import { money, paymentDate, shortId } from "@/lib/payments/ledger";
export function PaymentDetail({
  detail,
  matches,
  visible,
  onAttach,
  onClose,
}: {
  detail: Transaction | null;
  matches: Transaction[];
  visible: PaymentWorkspace | null;
  onAttach: (payment: Transaction) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (detail) {
      trigger.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    }
  }, [detail]);
  return (
    <dialog
      ref={dialog}
      className="payment-detail"
      aria-labelledby="payment-detail-heading"
      onClose={() => {
        onClose();
        trigger.current?.focus();
      }}
    >
      <div className="payment-detail-heading">
        <h2 id="payment-detail-heading">Payment details</h2>
        <button
          className="icon-button"
          aria-label="Close payment details"
          onClick={() => dialog.current?.close()}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      {detail && (
        <>
          <p className="detail-merchant">{detail.merchant}</p>
          <strong className="detail-amount">
            {money(detail.amount_cents, detail.currency)}
          </strong>
          <dl className="payment-definition">
            <dt>Status</dt>
            <dd>{detail.status}</dd>
            <dt>Payment reference</dt>
            <dd>{detail.id}</dd>
            <dt>Created · UTC</dt>
            <dd>{new Date(detail.created_at).toISOString()}</dd>
            {detail.decline_code && (
              <>
                <dt>Decline code</dt>
                <dd>{detail.decline_code}</dd>
              </>
            )}
          </dl>
          {matches.some((match) => match.id === detail.id) && (
            <div className="detail-matches">
              <h3>Possible matching charges</h3>
              {matches
                .filter(
                  (match) =>
                    match.merchant === detail.merchant &&
                    match.amount_cents === detail.amount_cents &&
                    match.currency === detail.currency &&
                    Math.abs(
                      Date.parse(match.created_at) -
                        Date.parse(detail.created_at),
                    ) <= 300000,
                )
                .map((match) => (
                  <p key={match.id}>
                    {shortId(match.id)} ·{" "}
                    {money(match.amount_cents, match.currency)} ·{" "}
                    {paymentDate(match.created_at)}
                  </p>
                ))}
              <small>Matching records do not prove a duplicate purchase.</small>
            </div>
          )}
          <h3>Refund history</h3>
          {visible?.refunds
            .filter((refund) => refund.transaction_id === detail.id)
            .map((refund) => (
              <p key={refund.id}>
                {money(refund.amount_cents, refund.currency)} ·{" "}
                {refund.status.replaceAll("_", " ")}
              </p>
            ))}
          {!visible?.refunds.some(
            (refund) => refund.transaction_id === detail.id,
          ) && <p>No refunds recorded for this payment.</p>}
          <button
            className="green-button"
            onClick={() => {
              onAttach(detail);
              dialog.current?.close();
              requestAnimationFrame(() =>
                document.getElementById("dashboard-message")?.focus(),
              );
            }}
          >
            Add to investigation <ArrowRight size={15} aria-hidden="true" />
          </button>
        </>
      )}
    </dialog>
  );
}
