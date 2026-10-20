import { createDatabaseClient } from '@/lib/db/client';
import { createRefundStore } from '@/lib/db/refunds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const refunds = await createRefundStore(createDatabaseClient()).queue();
    return Response.json({ refunds }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'The approval queue could not be loaded. Check the database connection and migrations, then retry.' }, { status: 503 });
  }
}
