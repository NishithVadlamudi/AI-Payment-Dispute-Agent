# Continue locally with Codex

The application is on GitHub. Cloud environment settings, injected API keys, Docker volumes and installed skills are separate and do not transfer when you clone it. No cloud environment is required to develop or run the app locally.

## Start the app

Use macOS, Linux, or WSL2 on Windows. Install Git, Node.js 24, and Docker with Compose; start Docker. Full local Supabase is an alternative described in [the engineering guide](engineering.md).

```bash
git clone https://github.com/NishithVadlamudi/AI-Payment-Dispute-Agent.git
cd AI-Payment-Dispute-Agent
npm ci
npm run db:test:start
cp -n .env.test-db .env.local
```

Preserve an existing `.env.local`. The helper generates database-only credentials and applies the migrations without resetting retained data. Add your own `GEMINI_API_KEY` to `.env.local`, leaving the generated database bindings in place. Set `AI_PROVIDER=gemini` and `GEMINI_MODEL=gemini-3.5-flash-lite`. Check your project's model access and quota in Google AI Studio. Do not paste the key into Codex chat or commit it.

For a new, unseeded database:

```bash
npm run db:seed
npm run dev
```

Open port 3000 in your local browser. Start at `/payments`, choose a demo customer, inspect a payment, and prepare an investigation. Review the unsent draft on `/demo` before sending it, then use Approvals and Activity. See [responsive workspace and iOS installation](responsive-workspace.md). AI quota failures are reported honestly. Human approval is required even for fictional refunds.

```bash
npm test
npm run test:db
npm run build
```

Stop the database with `npm run db:test:stop`; its volume persists. Re-seeding refreshes the known sample timestamps/statuses. It does not transfer cloud requests, traces, budget allocations or evaluation history. The repository includes a summary of the [recorded partial live eval](evaluation-results.md), not a newly populated local monitoring database.

## Install the requested Codex skills

Install/sign in to [Codex CLI](https://developers.openai.com/codex/cli/) and install [Bun](https://bun.sh/docs/installation). This installer supports macOS/Linux/WSL2, requires Codex CLI 0.122+ and Bun 1.4.2+, and uses the existing Node.js 24. Your machine needs GitHub, npm and the upstream browser/package download destinations available; the cloud allowlist does not control your laptop.

Preview the commands, check prerequisites, then install:

```bash
node scripts/setup-codex-skills.mjs --dry-run
node scripts/setup-codex-skills.mjs --check
node scripts/setup-codex-skills.mjs
```

| Source | Local integration |
| --- | --- |
| `addyosmani/agent-skills` | Native Codex plugin |
| `dietrichgebert/ponytail` | Native Codex plugin; review its optional hooks in Codex `/hooks` |
| `Leonxlnx/taste-skill` | Native Codex plugin |
| `emilkowalski/skills` | Individual Codex skill links |
| `garrytan/gstack` | Its supported `--host codex` installer |
| `morluto/rea` | Its released setup, scoped to Codex; review its own setup plan |
| `VoltAgent/awesome-design-md` | Local design library and a small reference skill wrapper |

Sources are retained under `~/.local/share/payment-dispute-codex-skills/`. Standalone skills use the existing `CODEX_HOME/skills`, or `~/.codex/skills` when unset. The script does not override HOME/CODEX_HOME, install into `~/.claude`, reset existing checkouts, replace existing skills or change application dependencies. Native plugin and REA installers own their Codex configuration changes. Their marketplace/package releases can differ from repository main. A completed run records checkout SHAs in `sources.json` under the local source directory; repeated runs reuse those checkouts rather than silently pulling updates. REA's `latest` and native marketplace references follow their upstream release policies.

Start a new local Codex session after installation. Ponytail hook trust, REA MCP connection and browser/native-analysis readiness are separate from copying instructions. No hook trust is bypassed. Gstack's iOS features require Apple/device tooling; REA's optional analysis engines are separate dependencies. Read the upstream partial-readiness messages rather than assuming every tool works on every machine. Installation on your laptop has not been executed or verified by this cloud session.

## Open the project in Codex

From the cloned repository, run `codex` and use this handoff:

> Continue AI Payment Dispute Agent from this checkout. Read AGENTS.md, README.md and docs/engineering.md. Phases 1–5 are implemented. Keep all payments fictional, retain human refund approval and database idempotency, and preserve the documented partial eval result. First verify my local environment, then report any blockers before choosing new feature work. Do not deploy or connect real payment credentials.

No Vercel deployment is required for local development. Public deployment is a separate task.
