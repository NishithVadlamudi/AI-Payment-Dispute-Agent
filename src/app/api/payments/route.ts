import { z } from "zod";
import { loadPaymentWorkspace } from "@/lib/payments/store";

export const dynamic = "force-dynamic";
const input = z.strictObject({ customer_id: z.uuid() });

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const checked = input.safeParse(Object.fromEntries(query));
  if (!checked.success || query.getAll("customer_id").length !== 1)
    return Response.json(
      { error: "Choose one valid demo customer to load payments." },
      { status: 400 },
    );
  try {
    const data = await loadPaymentWorkspace(checked.data.customer_id);
    if (!data)
      return Response.json(
        { error: "That demo customer is unavailable." },
        { status: 404 },
      );
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      {
        error:
          "Payments could not be loaded. Check the database connection and try again.",
      },
      { status: 503 },
    );
  }
}
