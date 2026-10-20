import { ArrowRight, ShieldCheck } from "lucide-react";
import type { Transaction } from "@/lib/db/schemas";
export function MatchingPayments({
  matches,
  onSelect,
}: {
  matches: Transaction[];
  onSelect: (payment: Transaction) => void;
}) {
  return (
    <section className="matching-card surface-panel">
      <div className="panel-title">
        <h2>Needs a closer look</h2>
        <ShieldCheck size={16} aria-hidden="true" />
      </div>
      {matches.length ? (
        <>
          <strong className="matching-count">
            {matches.length}
            <small>matching charges</small>
          </strong>
          <h3>
            Same merchant.
            <br />
            Similar payment timing.
          </h3>
          <p>
            These successful charges share an amount, currency and merchant,
            within five minutes of each other.
          </p>
          <button className="text-button" onClick={() => onSelect(matches[0])}>
            Review matching payments <ArrowRight size={14} aria-hidden="true" />
          </button>
        </>
      ) : (
        <>
          <strong className="matching-count">
            0<small>matching charges</small>
          </strong>
          <p>No possible duplicate charges were found in the loaded records.</p>
        </>
      )}
      <div className="matching-note">
        <ShieldCheck size={14} aria-hidden="true" />
        <span>
          Matching charges are a signal, not proof. Confirm one purchase before
          proposing a refund.
        </span>
      </div>
    </section>
  );
}
