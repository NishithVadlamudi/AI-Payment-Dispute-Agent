import "server-only";
import { PostgrestClient } from "@supabase/postgrest-js";

export class ConfigurationError extends Error {}
export type DatabaseClient = Pick<PostgrestClient<any>, "from" | "rpc">;

export function createDatabaseClient(): DatabaseClient {
  const url =
    process.env.POSTGREST_URL ||
    (process.env.SUPABASE_URL
      ? `${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1`
      : "");
  const key =
    process.env.POSTGREST_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new ConfigurationError(
      "Connect the demo database with POSTGREST_URL and POSTGREST_SERVICE_KEY, or the existing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY settings.",
    );
  return new PostgrestClient(url, {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
}
