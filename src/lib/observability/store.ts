import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runSchema, type AgentRun } from './schemas';
import { TraceUnavailableError } from './errors';

export interface TraceStore {
  start(run: AgentRun): Promise<void>;
  save(run: AgentRun): Promise<void>;
}
export function createTraceStore(db: SupabaseClient): TraceStore {
  return {
    async start(run) {
      const { error } = await db.from('agent_runs').insert(runSchema.parse(run));
      if (error) throw new TraceUnavailableError();
    },
    async save(run) {
      const { data, error } = await db.from('agent_runs').update(runSchema.parse(run)).eq('id', run.id).select('id');
      if (error || data?.length !== 1) throw new TraceUnavailableError();
    },
  };
}
export async function recentRuns(db: SupabaseClient, source: 'chat' | 'eval' | 'all', runId?: string) {
  let query = db.from('agent_runs').select('*').order('started_at', { ascending: false }).limit(20);
  if (source !== 'all') query = query.eq('source', source);
  if (runId) query = query.eq('id', runId);
  const { data, error } = await query;
  if (error) throw new TraceUnavailableError();
  return z.array(runSchema).parse(data);
}
