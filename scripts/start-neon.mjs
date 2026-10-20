import { randomBytes } from "node:crypto";
import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

if (!process.env.DATABASE_URL_UNPOOLED && !process.env.DATABASE_URL) {
  console.error("Neon is not connected. Sign in, then run neon deploy to pull the database environment variables.");
  process.exit(1);
}
if (!existsSync(".next/standalone/server.js")) {
  console.error("Build the app first with npm run build.");
  process.exit(1);
}

// Standalone builds omit these assets; Docker copies them in its own build stage.
cpSync("public", ".next/standalone/public", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
const server = spawn(process.execPath, ["--use-env-proxy", "--use-system-ca", "deploy/start.mjs"], {
  env: {
    ...process.env,
    PGRST_JWT_SECRET: process.env.PGRST_JWT_SECRET || randomBytes(32).toString("hex"),
    RESOLVE_APP_DIRECTORY: resolve(".next/standalone"),
  },
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("error", () => {
  console.error("The Neon application server could not start.");
  process.exitCode = 1;
});
server.on("exit", (code) => { process.exitCode = code ?? 1; });
