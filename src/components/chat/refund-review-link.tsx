import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { toolSchemas } from "@/lib/tools/definitions";
import { money } from "@/lib/payments/ledger";
import type { ToolActivity } from "./tool-activity";

export function RefundReviewLink({ calls }: { calls: ToolActivity[] }) {
  const requests = calls
    .filter((call) => call.name === "request_refund" && call.status === "done")
    .map((call) => toolSchemas.request_refund.output.safeParse(call.result))
    .flatMap((result) =>
      result.success && result.data.refund.status === "pending_approval"
        ? [result.data.refund]
        : [],
    );
  const unique = [
    ...new Map(requests.map((refund) => [refund.id, refund])).values(),
  ];
  if (!unique.length) return null;
  return (
    <div className="refund-next-step">
      {unique.map((refund) => (
        <div key={refund.id}>
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>
              {money(refund.amount_cents, refund.currency)} refund ready for
              review
            </strong>
            <p>
              No refund has been issued. A person must approve this request.
            </p>
            <Link href={`/approvals#refund-${refund.id}`}>
              Review refund request <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
