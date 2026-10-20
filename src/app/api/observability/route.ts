import { z } from 'zod';
import { createDatabaseClient } from '@/lib/db/client';
import { recentRuns } from '@/lib/observability/store';
import { createEvalStore } from '@/lib/evals/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const source = params.get('source') || 'chat';
  const runId = params.get('run_id') ?? undefined;
  if (runId !== undefined && !z.uuid().safeParse(runId).success)
    return Response.json({ error: 'Choose a valid run ID.' }, { status: 400 });
  if (source !== 'chat' && source !== 'eval' && source !== 'all')
    return Response.json({ error: 'Choose chat, eval, or all runs.' }, { status: 400 });
  try {
    const db = createDatabaseClient();
    const [runs, reports] = await Promise.all([recentRuns(db, source, runId), createEvalStore(db).recent()]);
    return Response.json({ runs, reports }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Run details could not be loaded. Apply the latest database migrations and try again.' }, { status: 503 });
  }
}
