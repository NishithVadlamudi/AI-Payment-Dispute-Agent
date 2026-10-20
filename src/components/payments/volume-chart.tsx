import { useId } from "react";
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
  const pattern = useId().replaceAll(":", "");
  const days = dailyVolume(payments, end);
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
        <span>
          {paymentDate(days[0].date)}–{paymentDate(end)}
        </span>
      </div>
      <div className="chart-summary">
        <strong>{money(total, currency)}</strong>
        <span>Successful charges · 14 days</span>
      </div>
      <svg
        className="payment-chart-svg"
        viewBox="0 0 500 240"
        role="img"
        aria-label={`Daily successful payment volume, ${currency}, ${paymentDate(days[0].date)} to ${paymentDate(end)}`}
      >
        <defs>
          <pattern
            id={pattern}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <rect width="5" height="5" fill="var(--chart-pale)" />
            <path d="M0 0V5" stroke="var(--chart-stripe)" strokeWidth="1" />
          </pattern>
        </defs>
        {[0, 1, 2, 3].map((tick) => {
          const value = (ceiling * tick) / 3,
            y = 190 - (value / ceiling) * 170;
          return (
            <g key={tick}>
              <path
                d={`M52 ${y}H495`}
                stroke="var(--border)"
                strokeDasharray="4 5"
              />
              <text x="43" y={y + 4} textAnchor="end">
                {new Intl.NumberFormat("en-US", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(value / 100)}
              </text>
            </g>
          );
        })}
        {days.map((day, i) => {
          const height = (day.cents / ceiling) * 170,
            x = 56 + i * 31;
          return (
            <g key={day.date}>
              <rect
                x={x}
                y={190 - height}
                width="20"
                height={height}
                rx="10"
                fill={
                  day.cents === largest
                    ? "var(--green-solid)"
                    : `url(#${pattern})`
                }
              >
                <title>
                  {paymentDate(day.date)}: {money(day.cents, currency)}
                </title>
              </rect>
              {(i % 3 === 0 || i === 13) && (
                <text x={x + 10} y="215" textAnchor="middle">
                  {new Date(day.date).getUTCDate()}
                </text>
              )}
            </g>
          );
        })}
        <text x="270" y="237" textAnchor="middle">
          Daily totals · {currency} · UTC
        </text>
      </svg>
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
