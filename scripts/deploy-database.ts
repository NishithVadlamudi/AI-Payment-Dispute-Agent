import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";
import { createSeedData } from "../src/lib/demo/seed-data";

async function deployDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error(
      "Set DATABASE_URL privately before running database deployment.",
    );
  const url = new URL(connectionString);
  const local = ["localhost", "127.0.0.1", "db"].includes(url.hostname);
  // Remote connections always verify the database certificate.
  url.searchParams.delete("sslmode");
  url.searchParams.delete("channel_binding");
  const client = new Client({
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: true },
  });
  try {
    await client.connect();
    await client.query("select pg_advisory_lock(71280421)");
    await client.query(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
  end $$;
  grant usage on schema public to anon, service_role;
  alter default privileges in schema public grant select on tables to anon;
  alter default privileges in schema public grant all on tables to service_role;
  create schema if not exists resolve_deployment;
  create table if not exists resolve_deployment.migrations(name text primary key);`);
    for (const file of readdirSync("supabase/migrations")
      .filter((name) => /^\d+_[a-z_]+\.sql$/.test(name))
      .sort()) {
      const found = await client.query(
        "select 1 from resolve_deployment.migrations where name=$1",
        [file],
      );
      if (found.rowCount) continue;
      const sql = readFileSync(`supabase/migrations/${file}`, "utf8")
        .replace(/^begin;\s*/i, "")
        .replace(/commit;\s*$/i, "");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into resolve_deployment.migrations(name) values($1)",
          [file],
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
      console.log(`Applied ${file}`);
    }
    if (process.argv.includes("--seed")) {
      const count = await client.query(
        "select count(*)::int as count from public.transactions",
      );
      if (count.rows[0].count)
        console.log("Existing payments retained; seeding skipped.");
      else {
        await client.query("begin");
        try {
          for (const [table, rows] of Object.entries(createSeedData())) {
            const fields = Object.keys(rows[0]).map((field) => `"${field}"`);
            await client.query(
              `insert into public."${table}"(${fields.join(",")}) select ${fields.join(",")} from jsonb_populate_recordset(null::public."${table}", $1::jsonb) on conflict(id) do nothing`,
              [JSON.stringify(rows)],
            );
          }
          await client.query("commit");
          console.log("Seeded fictional demo records.");
        } catch (error) {
          await client.query("rollback");
          throw error;
        }
      }
    }
    console.log(
      "Database deployment complete. No existing customer records were reset.",
    );
  } catch (error) {
    console.error(
      "Database deployment failed. Check the connection, owner permissions and migration state.",
    );
    if (error && typeof error === "object" && "code" in error)
      console.error(`Database code: ${String(error.code)}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}
void deployDatabase().catch(() => {
  console.error(
    "Database deployment failed. Check the private connection settings.",
  );
  process.exitCode = 1;
});
