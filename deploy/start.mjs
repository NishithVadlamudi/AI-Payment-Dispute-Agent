import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

// PostgREST and migrations require session state; use Neon's direct connection.
const database = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const adapterPort = process.env.RESOLVE_DATA_PORT || "3001";
const adapterUrl = `http://127.0.0.1:${adapterPort}`;
const secret = process.env.PGRST_JWT_SECRET;
if (!database || !secret || secret.length < 32) {
  console.error(
    "Set DATABASE_URL and a PGRST_JWT_SECRET of at least 32 characters in the hosting dashboard.",
  );
  process.exit(1);
}
if (process.env.AUTO_MIGRATE !== "false") {
  const migration = spawnSync(
    process.execPath,
    ["deploy/db-init.cjs", "--seed"],
    { env: process.env, stdio: "inherit" },
  );
  if (migration.status !== 0) process.exit(1);
}
const databaseUrl = new URL(database);
const role = decodeURIComponent(databaseUrl.username);
if (!["localhost", "127.0.0.1", "db"].includes(databaseUrl.hostname)) {
  databaseUrl.searchParams.set("sslmode", "verify-full");
  const certificate = process.env.RESOLVE_CA_CERT || databaseUrl.searchParams.get("sslrootcert") ||
    ["/etc/ssl/certs/ca-certificates.crt", "/etc/ssl/cert.pem"].find(existsSync);
  if (!certificate || !existsSync(certificate)) {
    console.error("Set RESOLVE_CA_CERT to an existing trusted CA certificate bundle.");
    process.exit(1);
  }
  databaseUrl.searchParams.set("sslrootcert", certificate);
}
const adapterDatabase = databaseUrl.toString();
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const header = encode({ alg: "HS256", typ: "JWT" });
const payload = encode({ role });
const signature = createHmac("sha256", secret)
  .update(`${header}.${payload}`)
  .digest("base64url");
const key = `${header}.${payload}.${signature}`;

// The adapter is loopback-only. Its owner token never reaches browser bundles or disk.
const adapter = spawn(
  process.env.POSTGREST_EXECUTABLE || "postgrest",
  [],
  {
    env: {
      ...process.env,
      PGRST_DB_URI: adapterDatabase,
      PGRST_DB_SCHEMAS: "public",
      PGRST_DB_ANON_ROLE: "anon",
      PGRST_JWT_SECRET: secret,
      PGRST_SERVER_HOST: "127.0.0.1",
      PGRST_SERVER_PORT: adapterPort,
      PGRST_DB_POOL: "3",
      PGRST_LOG_LEVEL: "crit",
    },
    stdio: "ignore",
  },
);
let app;
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  adapter.kill("SIGTERM");
  app?.kill("SIGTERM");
  const timer = globalThis.setTimeout(() => {
    adapter.kill("SIGKILL");
    app?.kill("SIGKILL");
    process.exit(code);
  }, 5000);
  timer.unref();
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(0));
adapter.on("error", () => {
  console.error("The private database adapter could not start.");
  stop(1);
});
adapter.on("exit", () => {
  if (!stopping) {
    console.error(
      "The private database adapter stopped. Check the database connection in the hosting dashboard.",
    );
    stop(1);
  }
});
let ready = false;
for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
  try {
    const response = await fetch(adapterUrl + "/customers?select=id&limit=1", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {
    /* Managed Postgres may be waking from its free-plan idle state. */
  }
  await setTimeout(1000);
}
if (!ready) {
  console.error(
    "Database is not ready. Apply the schema using npm run db:deploy, then restart.",
  );
  stop(1);
} else {
  app = spawn(
    process.execPath,
    ["--use-env-proxy", "--use-system-ca", "server.js"],
    {
      env: {
        ...process.env,
        HOSTNAME: "0.0.0.0",
        POSTGREST_URL: adapterUrl,
        POSTGREST_SERVICE_KEY: key,
      },
      stdio: "inherit",
      cwd: process.env.RESOLVE_APP_DIRECTORY || process.cwd(),
    },
  );
  app.on("error", () => {
    console.error("The web app could not start.");
    stop(1);
  });
  app.on("exit", (code) => {
    if (!stopping) stop(code || 1);
  });
}
