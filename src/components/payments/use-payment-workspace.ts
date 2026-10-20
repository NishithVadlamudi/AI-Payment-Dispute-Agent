"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { customerSchema, type Customer } from "@/lib/db/schemas";
import {
  paymentWorkspaceSchema,
  type PaymentWorkspace,
} from "@/lib/payments/schemas";
import { scenarios } from "@/lib/demo/scenarios";

export function usePaymentWorkspace() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [data, setData] = useState<PaymentWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [currency, setCurrency] = useState("USD");
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/customers", {
          signal: abort.signal,
          cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            typeof body.error === "string"
              ? body.error
              : "Demo accounts could not be loaded.",
          );
        const next = z
          .object({ customers: z.array(customerSchema) })
          .parse(body).customers;
        setCustomers(next);
        if (!next.length)
          throw new Error(
            "No demo accounts are available. Seed the database and retry.",
          );
        setCustomerId((current) =>
          next.some((customer) => customer.id === current)
            ? current
            : next.find((customer) => customer.id === scenarios[0].customerId)
                ?.id || next[0].id,
        );
      } catch (cause) {
        if (!abort.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Accounts could not be loaded.",
          );
          setLoading(false);
        }
      }
    }
    void load();
    return () => abort.abort();
  }, [revision]);

  useEffect(() => {
    if (!customerId) return;
    const abort = new AbortController();
    setData(null);
    setLoading(true);
    setError("");
    async function load() {
      try {
        const response = await fetch(
          `/api/payments?customer_id=${encodeURIComponent(customerId)}`,
          { signal: abort.signal, cache: "no-store" },
        );
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            typeof body.error === "string"
              ? body.error
              : "Payments could not be loaded.",
          );
        const next = paymentWorkspaceSchema.parse(body);
        if (next.customer.id !== customerId)
          throw new Error(
            "The returned payment account did not match. Please retry.",
          );
        if (!abort.signal.aborted) {
          setData(next);
          setCurrency(
            next.transactions.some((payment) => payment.currency === "USD")
              ? "USD"
              : next.transactions[0]?.currency || "USD",
          );
        }
      } catch (cause) {
        if (!abort.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Payments could not be loaded.",
          );
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => abort.abort();
  }, [customerId, revision]);

  return {
    customers,
    customerId,
    setCustomerId,
    data,
    loading,
    error,
    currency,
    setCurrency,
    refresh: () => setRevision((current) => current + 1),
  };
}
