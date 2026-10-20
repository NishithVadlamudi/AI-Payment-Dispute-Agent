import type { Transaction } from "../db/schemas";

export function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
}
export function shortId(id: string) {
  return `pay_${id.replaceAll("-", "").slice(-8)}`;
}
export function paymentDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
export function summarizePayments(payments: Transaction[]) {
  const succeeded = payments.filter(
    (payment) => payment.status === "succeeded",
  );
  return {
    count: payments.length,
    succeeded: succeeded.length,
    volume: succeeded.reduce((sum, payment) => sum + payment.amount_cents, 0),
    pending: payments.filter((payment) => payment.status === "pending").length,
    declined: payments.filter((payment) => payment.status === "declined")
      .length,
  };
}
export function duplicateCandidates(payments: Transaction[]) {
  const matches = new Set<string>();
  for (let i = 0; i < payments.length; i++)
    for (let j = i + 1; j < payments.length; j++) {
      const a = payments[i],
        b = payments[j];
      if (
        a.status === "succeeded" &&
        b.status === "succeeded" &&
        a.customer_id === b.customer_id &&
        a.currency === b.currency &&
        a.amount_cents === b.amount_cents &&
        a.merchant === b.merchant &&
        Math.abs(Date.parse(a.created_at) - Date.parse(b.created_at)) <=
          5 * 60_000
      ) {
        matches.add(a.id);
        matches.add(b.id);
      }
    }
  return payments.filter((payment) => matches.has(payment.id));
}
export function dailyVolume(payments: Transaction[], end: string) {
  const last = new Date(end);
  last.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: 14 }, (_, index) => {
    const day = new Date(last);
    day.setUTCDate(day.getUTCDate() - 13 + index);
    const key = day.toISOString().slice(0, 10);
    return {
      date: key,
      cents: payments
        .filter(
          (payment) =>
            payment.status === "succeeded" &&
            payment.created_at.slice(0, 10) === key,
        )
        .reduce((sum, payment) => sum + payment.amount_cents, 0),
    };
  });
}
export function paymentCsv(payments: Transaction[]) {
  // Quote every field and neutralize spreadsheet formulas in untrusted merchant text.
  const cell = (value: string | number) =>
    `"${String(value)
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""')}"`;
  return [
    [
      "Payment ID",
      "Merchant",
      "Amount cents",
      "Currency",
      "Status",
      "Created at UTC",
    ],
    ...payments.map((payment) => [
      payment.id,
      payment.merchant,
      payment.amount_cents,
      payment.currency,
      payment.status,
      payment.created_at,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
