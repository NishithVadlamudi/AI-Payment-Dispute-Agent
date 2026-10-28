# Free deployment: Render + Neon

Latest verification (2026-10-27): **[the public Render demo is live](https://resolve-payments.onrender.com/payments)** at commit `cea784a`. Render built the Linux Docker image and passed `/api/health`; independent HTTPS checks loaded 20 customers, 15 customer-scoped payments and the approval queue. The live browser opened matching-payment evidence. Production retained 20 customers, 300 payments and zero mock refund executions. No model call or refund write was made during deployment verification. `AUTO_MIGRATE=false` preserved the existing migrated database. GitHub CI passed all 131 key-free tests, type checking, both dataset validations and the default production build. Earlier unverified-deployment statements below describe prior environments. Evaluation remains partial; see [the decision log](first-run-notes.md).

No Vercel or hosted Supabase account is required. The repository includes a Render Blueprint that explicitly requests one **Free** Docker web service, plus an external Neon **Free** Postgres project that you create in your account. Do not select a paid plan or enable an upgrade to complete this setup. Provider availability and account requirements must be confirmed in their dashboards.

[Deploy this repository on Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2FNishithVadlamudi%2FAI-Payment-Dispute-Agent)

## Set up the accounts

1. Create a project on Neon’s Free plan. In Connect, select the database-owner role and copy the **direct, unpooled** connection string. Keep it private. Do not put it in a GitHub file or paste it into chat.
2. Use the Render deploy link above, or choose New → Blueprint and connect `NishithVadlamudi/AI-Payment-Dispute-Agent`. Render reads `render.yaml`; verify the service plan says **Free** before creating it. No Render database, disk or worker service is requested.
3. Enter these values in Render’s private environment settings:

   | Setting | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon’s direct database-owner connection string |
   | `GEMINI_API_KEY` | Your Google AI Studio key, with your project’s free-tier model access |
   | `PGRST_JWT_SECRET` | Generated automatically by the Blueprint; keep it secret |

   The Blueprint supplies Gemini model/budget names. Model access and API quotas are separate from free hosting; the app does not automatically switch to a paid provider when quota is exhausted.
4. Deploy. On first startup, the app applies versioned SQL migrations and seeds the 20 fictional customers/300 payments only if the payment table is empty. Subsequent starts preserve existing records. Wait for `/api/health` to pass, then open the Render HTTPS URL at `/payments`.
5. On iPhone/iPad Safari, Share → Add to Home Screen. On Android/desktop, use the browser’s install action if available. The application requires a network connection.

This creates a portfolio demo, not a real payment processor or an authenticated bank support system. All refunds are mock ledger entries. The existing partial live evaluation report is not replaced by the deployment checks.

## Neon CLI setup for this repository

The project includes Neon's `neon` and `neon-postgres` agent skills and an OAuth-only Codex MCP configuration pinned to project `damp-truth-10948457`. No API key is stored in the MCP configuration. Codex must authorize the MCP connection before its tools can be used. The local `.neon` project/branch context and environment files are ignored by Git.

To finish linking the existing production branch from an authenticated terminal:

```bash
npx neon@latest login
npx neon@latest init -y --org-id org-hidden-union-27009054 --project-id damp-truth-10948457 --branch production --services postgres --no-agent-setup
npx neon@latest config plan
npx neon@latest deploy
npm run build
npm run start:neon
```

`neon deploy` configures the backend and pulls its connection variables; it does not publish the Next.js frontend. `start:neon` runs the existing standalone application and private PostgREST adapter. Install the PostgREST v13 executable first, or set `POSTGREST_EXECUTABLE` to its path; the Render Docker image already includes it. If port 3001 is occupied, set `RESOLVE_DATA_PORT` to a free port. The local launcher generates an in-memory JWT secret when none is supplied; a hosted deployment keeps using its private configured secret.

For macOS, use Node.js 24 (for example `nvm use 24`) and an Apple Silicon or Intel PostgREST v13 binary matching your computer. The upstream macOS binary also needs its Homebrew `libpq` runtime dependency. The launcher finds `postgrest` on `PATH`, or uses `POSTGREST_EXECUTABLE`. Remote database TLS uses `/etc/ssl/certs/ca-certificates.crt` on Linux or `/etc/ssl/cert.pem` on macOS. Set `RESOLVE_CA_CERT` to an existing trusted PEM bundle to override this selection; certificate verification stays enabled.

Both the adapter and migration runner prefer `DATABASE_URL_UNPOOLED`, falling back to `DATABASE_URL` for existing deployments with a direct URL. Preserve both variables supplied by Neon: PostgREST and the advisory-lock migration workflow need session state. The migration command reads `.env`, `.env.local`, then optional `.env.deploy`; exported environment values take priority. The existing data-access client and SQL migrations are retained.

The earlier cloud workspace could only write an offline link: Neon API/MCP access was blocked and no CLI credentials were available. Its `/workspace/shared/neon-cli` config-directory override is not required on your computer. Authenticate the local CLI in your own browser; console sign-in and Codex MCP OAuth are separate authorizations. Do not paste connection strings or API keys into chat.

Local verification completed on October 20–21, 2026 against the specified existing Neon project and production branch. The account reported its free plan; `neon config plan` confirmed Postgres only with no infrastructure changes, and `neon deploy` pulled both database URLs. A direct connection verified the client TLS certificate. All four migrations and 29 database integration tests passed on an isolated Neon branch before migrating and seeding the empty production database. A repeat startup skipped seeding and retained records. The local standalone app loaded customer/payment APIs, the dashboard and matching-charge details from Neon. Two approval API calls against an isolated Neon fixture produced exactly one mock execution; production refund history was untouched. The temporary branch was deleted after approval. Codex MCP OAuth was also authenticated and verified.

The full-width workspace refresh passes the production build and all 129 unit/API/UI tests. Browser checks covered mobile through large desktop widths, sorting, row counts and chart periods. Gemini configuration and budget settings were preserved, but live model calls were not tested during this setup. The documented partial AI evaluation remains unchanged. These results verify a local app with a Neon database; they do not establish a public Render deployment.

## Runtime architecture

The Docker image runs a Node.js 24 Next.js standalone server and a loopback-only PostgREST process. The external platform exposes only the web server. PostgREST connects to Neon using a certificate-verified connection; the app’s owner-role token is generated in memory from the server secret and never enters browser bundles. The SQL schema, refund locks, uniqueness constraints, rate controls and audit tables remain Postgres-based.

The Supabase hosting platform is not used. `@supabase/postgrest-js` remains a protocol client for the open-source PostgREST API. Existing local Supabase/test-harness configuration still works through legacy environment aliases. New deployment configuration uses `DATABASE_URL` and the private adapter.

`deploy/start.mjs` supervises both processes. A startup migration failure stops the app; it does not serve fake payment data. A process failure stops its sibling so the host can restart the complete service. The adapter has a three-connection pool to limit database pressure. Application queries remain customer-scoped and bounded; refunds and abuse controls coordinate in the shared database.

Migrations are journaled in the non-exposed `resolve_deployment` schema and serialized with an advisory lock. The owner role needs schema ownership and permission to create the `anon`/`service_role` roles; no Postgres superuser or BYPASSRLS grant is requested. Do not point this first-run bootstrap at an unrelated database or a schema imported without its migration journal.

On PostgreSQL 16 and later, creating a role with `CREATEROLE` does not automatically allow switching into it. The bootstrap grants the database owner `SET` membership in the restricted `anon` role, without inheriting its privileges, so the private PostgREST adapter can enforce anonymous RLS correctly. The owner still supplies authenticated server requests using its in-memory owner token.

For a separate migration workflow, set `DATABASE_URL` in a private ignored `.env.deploy` file and run:

```bash
npm ci
npm run db:deploy -- --seed
```

Seeding is skipped when payments already exist. Never reset a database to troubleshoot a failed deployment. `AUTO_MIGRATE=false` disables startup migration when an external release workflow already handles it.

## Free-plan behavior

Budget accounting now has a tested settlement migration (`0005_budget_settlement.sql`). Before each turn the server still reserves the conservative maximum. Only a normally completed stream with validated provider token usage releases unused allowance, using the existing configured input/output rates. Missing/invalid usage, provider failures and cancellation retain the full reservation. SQL settlement is idempotent, locks the original day bucket, and cannot credit a different UTC day or raise its cap. Original reservation amounts and gross trace allocations remain recorded; the daily bucket reflects net retained allocation after settlement. These values remain conservative accounting estimates, not provider billing or quota guarantees. Existing reservations are not retroactively released. Apply the migration before deploying code that settles usage; a missing/failed settlement fails closed. This change is local and isolated-Neon-tested until its rollout is explicitly recorded.

Free services may sleep, start slowly, or suspend at their usage limits. Neon’s official Free-plan documentation confirms a $0 plan with resource quotas and idle scale-to-zero. Render’s account UI remains the source of truth for Free service eligibility and current allowances. The Blueprint does not provision a paid database or use a trial-only Postgres service.

The default request limiter conservatively shares a bucket when proxy headers are not trusted. Do not enable `TRUST_PROXY_HEADERS` unless your chosen proxy strips and rebuilds those headers. Budget controls never override provider quota or billing settings. No background keep-alive traffic is configured to defeat free-plan sleep policies.

## Verification and remaining checks

- Production Next.js build and 128 unit/API/UI tests passed.
- All 29 database integration tests passed with the backwards-compatible data client.
- A fresh Postgres database owned by a restricted `CREATEROLE` account applied all migrations and seeded successfully. A second migration/seed run preserved the data.
- The exact startup supervisor, PostgREST binary and standalone app ran together against that database; the payment/customer endpoints and 70 responsive browser checks passed without a hosted Supabase endpoint or any AI requests.
- A separate isolated browser test approved a real mock refund through the app, retried the decision API and confirmed exactly one execution. Its fixture was cleaned up.
- This environment blocked the Docker Hub Node base-image download, so the complete Docker image build still needs verification on Render (or a machine with Docker registry access). The component runtime was verified directly; this is not a claim of a live deployment.
- Neon TLS connectivity and the local standalone app were subsequently verified as described above. Render build/start and real iPhone Safari installation remain unverified. The earlier WebKit download was blocked. No public hosted frontend URL is implied.

References: [Render Free services](https://render.com/docs/free), [Neon Free plan](https://neon.com/faqs/free-plan-limits-and-quotas), [Neon role management](https://neon.com/docs/manage/roles), [Neon PostgREST guide](https://neon.com/docs/guides/postgrest). Neon documentation was checked in its official public source at `neondatabase/website`, commit `e9fcba8e946c14a3639a72fd9a9eff32edeba06b`; direct provider-site access was blocked in this environment.
