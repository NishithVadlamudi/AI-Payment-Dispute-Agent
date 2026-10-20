import type { Metadata } from "next";
import { PaymentDashboard } from "@/components/payments/payment-dashboard";
export const metadata: Metadata = { title: "Payment overview | Resolve" };
export default function PaymentsPage() {
  return <PaymentDashboard />;
}
