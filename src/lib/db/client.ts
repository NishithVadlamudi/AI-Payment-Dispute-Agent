import 'server-only';
import { createClient } from '@supabase/supabase-js';

export class ConfigurationError extends Error {}

export function createDatabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new ConfigurationError(
      'Connect the demo database by setting SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.',
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
