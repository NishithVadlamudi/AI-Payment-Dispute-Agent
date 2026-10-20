# Free deployment: Render + Neon

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

## How it runs

The Docker image runs a Node.js 24 Next.js standalone server and a loopback-only PostgREST process. The external platform exposes only the web server. PostgREST connects to Neon using a certificate-verified connection; the app’s owner-role token is generated in memory from the server secret and never enters browser bundles. The SQL schema, refund locks, uniqueness constraints, rate controls and audit tables remain Postgres-based.

The Supabase hosting platform is not used. `@supabase/postgrest-js` remains a protocol client for the open-source PostgREST API. Existing local Supabase/test-harness configuration still works through legacy environment aliases. New deployment configuration uses `DATABASE_URL` and the private adapter.

`deploy/start.mjs` supervises both processes. A startup migration failure stops the app; it does not serve fake payment data. A process failure stops its sibling so the host can restart the complete service. The adapter has a three-connection pool to limit database pressure. Application queries remain customer-scoped and bounded; refunds and abuse controls coordinate in the shared database.

Migrations are journaled in the non-exposed `resolve_deployment` schema and serialized with an advisory lock. The owner role needs schema ownership and permission to create the `anon`/`service_role` roles; no Postgres superuser or BYPASSRLS grant is requested. Do not point this first-run bootstrap at an unrelated database or a schema imported without its migration journal.

For a separate migration workflow, set `DATABASE_URL` in a private ignored `.env.deploy` file and run:

```bash
npm ci
npm run db:deploy -- --seed
```

Seeding is skipped when payments already exist. Never reset a database to troubleshoot a failed deployment. `AUTO_MIGRATE=false` disables startup migration when an external release workflow already handles it.

## Free-plan behavior

Free services may sleep, start slowly, or suspend at their usage limits. Neon’s official Free-plan documentation confirms a $0 plan with resource quotas and idle scale-to-zero. Render’s account UI remains the source of truth for Free service eligibility and current allowances. The Blueprint does not provision a paid database or use a trial-only Postgres service.

The default request limiter conservatively shares a bucket when proxy headers are not trusted. Do not enable `TRUST_PROXY_HEADERS` unless your chosen proxy strips and rebuilds those headers. Budget controls never override provider quota or billing settings. No background keep-alive traffic is configured to defeat free-plan sleep policies.

## Verification and remaining checks

- Production Next.js build and 128 unit/API/UI tests passed.
- All 29 database integration tests passed with the backwards-compatible data client.
- A fresh Postgres database owned by a restricted `CREATEROLE` account applied all migrations and seeded successfully. A second migration/seed run preserved the data.
- The exact startup supervisor, PostgREST binary and standalone app ran together against that database; the payment/customer endpoints and 70 responsive browser checks passed without a hosted Supabase endpoint or any AI requests.
- A separate isolated browser test approved a real mock refund through the app, retried the decision API and confirmed exactly one execution. Its fixture was cleaned up.
- This environment blocked the Docker Hub Node base-image download, so the complete Docker image build still needs verification on Render (or a machine with Docker registry access). The component runtime was verified directly; this is not a claim of a live deployment.
- Actual Neon TLS connectivity, Render build/start and real iPhone Safari installation require your accounts/deployed URL. WebKit download was also blocked here. No platform account, database credentials or live URL has been fabricated.

References: [Render Free services](https://render.com/docs/free), [Neon Free plan](https://neon.com/faqs/free-plan-limits-and-quotas), [Neon role management](https://neon.com/docs/manage/roles), [Neon PostgREST guide](https://neon.com/docs/guides/postgrest). Neon documentation was checked in its official public source at `neondatabase/website`, commit `e9fcba8e946c14a3639a72fd9a9eff32edeba06b`; direct provider-site access was blocked in this environment.
