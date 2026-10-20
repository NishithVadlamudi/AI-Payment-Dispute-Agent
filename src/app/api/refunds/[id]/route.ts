import { z } from 'zod';
import { createDatabaseClient } from '@/lib/db/client';
import { createRefundStore, decisionSchema, RefundError } from '@/lib/db/refunds';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  // This is a public fictional reviewer, not an authenticated banking operator.
  // Requiring the same origin also prevents drive-by cross-site form submissions.
  const origin = request.headers.get('origin');
  // Next may use its bind address for request.url. Compare the browser origin
  // with the public Host forwarded by the deployment proxy instead.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host;
  let sameOrigin = false;
  try {
    const source = new URL(origin ?? '');
    sameOrigin = ['http:', 'https:'].includes(source.protocol) && source.host === host.toLowerCase();
  } catch { /* Missing or malformed origins cannot authorize a browser decision. */ }
  if (!sameOrigin)
    return Response.json({ error: 'Use the approval queue on this site to review refunds.' }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = decisionSchema.safeParse(body);
  if (!z.uuid().safeParse(id).success || !parsed.success)
    return Response.json({ error: 'Choose Approve or Reject for a valid refund.' }, { status: 400 });
  try {
    const refund = await createRefundStore(createDatabaseClient()).decide(id, parsed.data.decision);
    return Response.json({ refund }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof RefundError ? error.message : 'The decision could not be confirmed. Refresh the queue before retrying.' },
      { status: error instanceof RefundError && error.code !== 'REFUND_UNAVAILABLE' ? 409 : 503 });
  }
}
