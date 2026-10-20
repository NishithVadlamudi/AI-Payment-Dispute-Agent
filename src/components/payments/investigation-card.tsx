"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, X } from "lucide-react";
import type { Transaction } from "@/lib/db/schemas";
import { money, shortId } from "@/lib/payments/ledger";
import { MAX_MESSAGE_LENGTH } from "@/lib/security/limits";
import { scenarios } from "@/lib/demo/scenarios";

export const INVESTIGATION_DRAFT_KEY = "resolve-investigation-draft";
export function InvestigationCard({
  customerId,
  payment,
  onRemovePayment,
}: {
  customerId: string;
  payment: Transaction | null;
  onRemovePayment?: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  function prepare(message: string, customer: string) {
    try {
      sessionStorage.setItem(
        INVESTIGATION_DRAFT_KEY,
        JSON.stringify({ customer_id: customer, message }),
      );
      router.push(`/demo?customer_id=${encodeURIComponent(customer)}`);
    } catch {
      setError(
        "Your browser could not save the draft. Open Investigate and paste your question there.",
      );
    }
  }
  return (
    <section
      className="agent-card surface-panel"
      aria-labelledby="agent-heading"
    >
      <div className="agent-card-label">
        <Sparkles size={20} aria-hidden="true" />
        Resolve agent
      </div>
      <h2 id="agent-heading">A payment doesn’t look right?</h2>
      <p>
        Tell the agent what happened. It checks the evidence; you decide the
        next step.
      </p>
      {payment && (
        <div className="attached-payment">
          {onRemovePayment && (
            <button
              type="button"
              className="remove-payment-context"
              onClick={onRemovePayment}
              aria-label="Remove attached payment"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
          <strong>{payment.merchant}</strong>
          <span>
            {money(payment.amount_cents, payment.currency)} ·{" "}
            {shortId(payment.id)}
          </span>
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (text)
            prepare(
              payment
                ? `${text}\nPayment reference: ${payment.id} (${money(payment.amount_cents, payment.currency)}).`
                : text,
              customerId,
            );
        }}
      >
        <label className="sr-only" htmlFor="dashboard-message">
          Describe a payment problem
        </label>
        <textarea
          id="dashboard-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={MAX_MESSAGE_LENGTH - 250}
          required
          placeholder={
            payment
              ? "What seems wrong with this payment?"
              : "I was charged twice yesterday…"
          }
        />
        <div className="scenario-pills">
          {scenarios.slice(0, 3).map((scenario) => (
            <button
              type="button"
              key={scenario.id}
              onClick={() => prepare(scenario.message, scenario.customerId)}
            >
              {scenario.label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          className="green-button"
          disabled={!customerId || !draft.trim()}
        >
          Prepare investigation <ArrowRight size={15} aria-hidden="true" />
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      <small>Review your draft before sending. No automatic AI request.</small>
    </section>
  );
}
