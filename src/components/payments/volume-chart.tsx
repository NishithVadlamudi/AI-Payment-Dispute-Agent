"use client";
import { useState } from "react";
import type { Transaction } from "@/lib/db/schemas";
import { dailyVolume, money, paymentDate } from "@/lib/payments/ledger";

export function VolumeChart({
  payments,
  currency,
  end,
}: {
  payments: Transaction[];
  currency: string;
  end: string;
}) {
  const [period, setPeriod] = useState(14);
  const [active, setActive] = useState<string | null>(null);
  const days = dailyVolume(payments, end).slice(-period);
  const selected = days.find((day) => day.date === active);
  const total = days.reduce((sum, day) => sum + day.cents, 0);
  const largest = Math.max(...days.map((day) => day.cents), 1);
  const ceiling = Math.ceil(largest / 10000) * 10000;
  return (
    <section
      className="payment-chart surface-panel"
      aria-labelledby="volume-heading"
    >
      <div className="panel-title">
        <h2 id="volume-heading">Payment activity</h2>
        <div className="chart-period" aria-label="Chart period">
          {[7, 14].map((count) => (
            <button
              key={count}
              aria-pressed={period === count}
              onClick={() => {
                setPeriod(count);
                setActive(null);
              }}
            >
              {count} days
            </button>
          ))}
        </div>
      </div>
      <div className="chart-summary">
        <strong>{money(total, currency)}</strong>
        <span>Successful charges · {period} days</span>
      </div>
      <div className="chart-inspect">
        {selected ? (
          <>
            <span>{paymentDate(selected.date)} · UTC</span>
            <strong>{money(selected.cents, currency)}</strong>
          </>
        ) : (
          <>
            <span>
              {paymentDate(days[0].date)} – {paymentDate(end)}
            </span>
            <span>Explore a day for its total</span>
          </>
        )}
      </div>
      <div
        className="volume-visual"
        role="group"
        aria-label={`Daily successful payment volume, ${currency}`}
      >
        <div className="volume-axis" aria-hidden="true">
          {[1, 0.5, 0].map((scale) => (
            <span key={scale}>
              {new Intl.NumberFormat("en-US", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format((ceiling * scale) / 100)}
            </span>
          ))}
        </div>
        <div
          className="volume-bars"
          style={{ gridTemplateColumns: `repeat(${period}, minmax(0, 1fr))` }}
        >
          {days.map((day, index) => (
            <button
              key={day.date}
              className={`volume-day ${active === day.date ? "is-active" : ""}`}
              aria-label={`${paymentDate(day.date)}: ${money(day.cents, currency)}`}
              aria-pressed={active === day.date}
              onMouseEnter={() => setActive(day.date)}
              onFocus={() => setActive(day.date)}
              onClick={() => setActive(day.date)}
            >
              <span
                className={`volume-bar ${day.cents === largest ? "peak" : ""}`}
                style={{
                  height: `${Math.max((day.cents / ceiling) * 100, 1.5)}%`,
                }}
              />
              <span className="volume-day-label" aria-hidden="true">
                {period === 7 || index % 2 === 0 || index === days.length - 1
                  ? new Date(day.date).getUTCDate()
                  : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
      <details className="chart-data">
        <summary>View chart data</summary>
        <ul>
          {days.map((day) => (
            <li key={day.date}>
              <span>{paymentDate(day.date)}</span>
              <span>{money(day.cents, currency)}</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
