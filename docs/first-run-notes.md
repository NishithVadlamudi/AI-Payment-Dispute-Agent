# First-run decision log

Entries record observed evidence. Infrastructure failures are not model-accuracy measurements. Earlier results remain in [evaluation-results.md](evaluation-results.md) and [free-deployment.md](free-deployment.md); the entries below do not retroactively establish an unseen holdout baseline.

## 2026-10-27 — Phase 1: establish the current core baseline

**Problem.** Before preparing public hosting and portfolio claims, verify the current approved UI commit (`093d254`) and the core payment/refund workflow. Previous results alone do not prove the current checkout works.

**Cause and approach.** Database tests mutate fixtures, so production cannot be their target. The prior temporary verification branch had already been deleted. Confirmed the existing Neon project `damp-truth-10948457` reports `free_v3`, with only its production branch present; created an included child branch `phase1-verification-20261027` (`br-small-forest-b5jc8urh`) from production. No project, paid service, package, production migration, or reset was introduced. Existing environment files were read privately and left unchanged.

**Verification.** On macOS with Node.js 24.14.1:

- `npm test`: 129 tests passed across 18 files, using mocked providers.
- `npm run typecheck`: passed.
- `npm run build`: passed for the production Next.js application.
- `npm run eval:validate`: all 40 cases validated; no model accuracy measured.
- Existing database suite: 29 tests passed across four files against the isolated **live Neon** branch through private loopback PostgREST with certificate verification enabled. Coverage includes scoped reads, integer cents, anonymous access restrictions, refund eligibility, concurrent requests/approvals, uniqueness constraints, shared rate/budget controls, and audit persistence. Legacy test names containing “Supabase” describe the protocol harness; the database target in this run was Neon.

**Separate end-to-end HTTP check.** Started the standalone application with its private adapter against the same isolated branch, with startup migration disabled. Loaded 20 customers and a nonempty, customer-scoped payment response with integer amounts. Inserted a disposable 1,234-cent charge, requested human review through the existing database RPC, confirmed zero executions from a second SQL connection, and confirmed the request appeared in the application queue API. Two concurrent same-origin approval HTTP requests both returned 200/succeeded. The independent SQL connection observed exactly one execution for 1,234 cents. Client TLS was encrypted and certificate-authorized. No Gemini calls were made. The second run loaded 16 scoped payments, including the disposable charge retained from the first smoke-check attempt; this is not a claim that production seed counts changed.

**Verification-script negative result.** The initial HTTP check stopped at its pending-status assertion: `node-postgres` returned a PostgreSQL composite as text, while the script expected an object. The application integration tests already passed. Root cause was the scratch script's result conversion, not the refund implementation. Changed its SELECT to `to_jsonb(request_demo_refund(...))`; the rerun passed the full HTTP/independent-connection assertions. Retained the first fixture on the isolated branch rather than deleting records opportunistically.

**Production observation after testing.** A separate read-only Neon MCP query against `br-cold-cloud-b5lojari` reported 20 customers, 300 transactions, and zero mock refund executions. All test writes targeted the child branch. Fixture records remain there pending explicit branch-cleanup approval; the verification processes stop after checking.

**Limits and next gate.** This phase verifies application infrastructure and deterministic safety, not end-to-end model quality or public hosting. The previous partial AI report (12/40 passes, 28 infrastructure errors) remains unchanged; provider/model and spending allowances were preserved. No dependency installs, commits, pushes, public deploys, or live evaluation calls were made. Phase 2 requires the user's phase approval and will define a new holdout before any tuning. A public Render service is not yet deployed.

## 2026-10-27 — Phase 2: separate measurement from infrastructure success

**Problem.** The original 40 cases had already been exercised, lacked an explicit development/holdout split, and could not support an unseen holdout claim. The evaluation CLI also printed “accuracy” even when the run was partial.

**Cause.** Dataset validation was tied to 30–50 cases, and the runner had a single hard-coded source. Some receipt, ineligible-refund and decline cases could receive an automated pass from a plausible generic explanation without evidence from the specified payment.

**Fix.** Preserve all 40 existing cases as development data. Add 16 manually authored holdout-draft prompts with explicit labels and a documented review/freeze protocol in `evals/README.md`. Add explicit `--split dev|holdout` selection, separate suite names and content hashes, and subset validation without weakening the development-set size requirement. Require successful target-payment evidence for the affected outcome types. Replace the CLI accuracy headline with the selected-suite pass rate, split, denominator and completion status. Add regression checks for unsupported generic answers, failed evidence reads, fixture ownership and split separation. No model prompt or application behavior was tuned.

**Negative result and interpretation.** A generic “payment succeeded” trace with no payment evidence could previously pass a receipt case; the tightened scorer rejects it. This improves measurement validity, not demonstrated model quality. The new holdout reuses demo fixture scenarios with new phrasing; it is not a test of entirely unseen financial situations. Its labels await independent human review. Earlier and tightened-scoring results are not directly comparable.

**Cleanup.** After the user's explicit approval, deleted only `br-small-forest-b5jc8urh`, the temporary Phase 1 branch and its retained verification fixtures. Production was not deleted or reset.

**Preflight verification.** All 131 key-free tests and type checking passed. Both splits validated (40 dev, 16 holdout). The default Turbopack build failed because the sandbox denied its CSS worker a local port bind, including after a network permission grant. The supported `npm run build -- --webpack` production build passed without changing package scripts or dependencies.

**Frozen inputs.** Dev SHA-256: `1990393b1ec5a43e955f9763085f1d8d22f39a5fd1534e8eafd3a036ff3406f9` (unchanged). Holdout-draft SHA-256: `7a55e95692dc45059f317f52406460d69a67175574fa8ff77351900b687788f6`. Starting commit: `093d254`, plus the reviewed local version-2 measurement changes described above. No model prompt or setting change.

**Live measurement authorization.** The user separately approved live Gemini evaluation within existing limits. Created isolated branch `phase2-eval-20261027` (`br-wispy-unit-b597ts1x`) and started the 40-case development baseline with verified TLS/private PostgREST. The holdout remains unrun pending independent label review and implementation freeze. The original partial report remains unchanged. No dependencies were installed, and no commit, push or public deployment was performed.

**Measured result.** Report `6844bf0a-d470-4863-8116-80750a726dde`: eight model-backed passes (four duplicate-charge cases and four decline explanations), eight deterministic guard passes, one attempted case blocked by the daily allowance and 23 subsequent skipped cases. Selected-suite pass rate 16/40; status partial; runner exited nonzero. Average attempted-case latency 19,224 ms, average estimated cost 29,333 microUSD with 17/17 attempted-case coverage; total allocated allowance 4,463,770 microUSD. These averages include the eight guard cases and are not model-only response averages. Persisted status/counts were confirmed through an independent Neon MCP SQL connection. Details and interpretation are in `docs/evaluation-baseline-v2.md`. No retry, cap increase, or model/prompt tuning followed the limit. The unchanged original partial report and tightened scoring prevent a valid before/after model-quality comparison. Phase 2's measurement remains incomplete, with the holdout deliberately unrun.

## 2026-10-27 — Product verification and free-hosting preparation

**Problem.** Prepare the approved UI for a public portfolio demo without claiming incomplete evaluation results or exposing local configuration. The repository had no GitHub Actions workflow.

**Fix.** Added `.github/workflows/ci.yml` for every push and pull request: Node 24, locked dependency installation, key-free tests, type check, both dataset validations, production build and migration-bundle compilation. It requests read-only repository permissions, retains no checkout credentials, has a 15-minute timeout, and makes no live model or database requests. Excluded `.neon` metadata and generated evaluation reports from the Docker build context alongside existing environment-file exclusions. No new package or redesign was introduced.

**Measured local result.** All 131 key-free tests, type checking, both dataset validations and migration-bundle compilation passed. The production Webpack build passed during Phase 2; the default Turbopack build remains blocked by this session's CSS-worker port restriction. The new hosted CI workflow has not run because the local changes have not been committed or pushed.

**Visual and interaction evidence.** Checked the existing local `/payments` UI at 1440, 768 and 390 pixels in both themes; viewport and document widths matched in all six checks. Viewed screenshots of the desktop, tablet and phone layouts. Matching charges opened the payment-detail dialog with both 8,499-cent references and the explicit warning that matching records do not prove a duplicate purchase. Adding the selected payment attached its merchant, amount and reference to an unsent investigation; removed the test attachment afterward. The standard ledger/detail controls are the plain fallback. No model call or refund write was made for these UI checks. The requested taste-skill executables were not found in the repository or installed skill directories, so no taste-tool execution is claimed.

**Cleanup and external gates.** After explicit approval, deleted only the Phase 2 evaluation branch `br-wispy-unit-b597ts1x`; a local JSON report and version-2 summary were preserved. Docker's daemon was unavailable for an image build. Render dashboard opened at its sign-in page; account eligibility, billing controls and actual service provisioning remain unverified. The existing Blueprint declares one Free Docker web service and external Neon Postgres; no public deployment has been created and no live HTTPS URL is claimed. Provider sign-in and Docker runtime startup were requested from the user. Commit/push approval remains required under the supplied working rules.

## 2026-10-27 — Docker build verified; Render account connected

**Problem and cause.** After the user started Docker, sandbox access to its daemon socket and builder metadata was required. The normal Docker credential helper failed with a Module Directory Service error while pulling public images. An isolated empty Docker configuration avoided the credential helper, but initially selected the legacy builder, which cannot handle the existing `COPY --chmod` instruction.

**Fix and measured result.** Used a scratch Docker configuration with the already-installed BuildKit plugin and public image pulls; original saved Docker credentials and the Dockerfile were unchanged. Built `linux/amd64` image `resolve-payments:verification` successfully, image ID `sha256:7a84964594bb832dfc914cfa9f1e71348d7fd185215f176fe5ba8f2306eddf87`. The default Turbopack production build, TypeScript checks and migration bundle completed inside Linux. This resolves the prior image-build gap; runtime evidence is recorded separately when complete.

**Dependency audit.** `npm audit --omit=dev --json` reported zero production dependency vulnerabilities. The full audit reported two critical advisories (Vitest/tinypool) and one moderate advisory (@vitest/mocker), all in development tooling; npm proposes a major Vitest upgrade. No forced fix or dependency change was applied. Do not run the test tooling as a public development server. A separate reviewed upgrade remains outstanding.

**Render preparation.** Confirmed sign-in. Selected the public Git repository source, Docker runtime, `main`, service name `resolve-payments`, the $0 Free instance (the form initially defaulted to $7/month), and `/api/health`. No paid plan or new database was selected. Prepared a permission-restricted environment import outside Git using existing Neon/Gemini settings and a new server JWT secret, with `AUTO_MIGRATE=false` to preserve the already-migrated production data. The user imports it directly into Render's private environment form; secret values are never printed in chat. Deployment has not been submitted at this point. The user explicitly approved committing and pushing the prepared measurement/CI/documentation changes.

**Container runtime verification.** Started the AMD64 image on loopback port 3320 with the private deployment environment injected at runtime, not baked into the image. `/api/health` passed; the customer API returned 20 customers and the scoped payment API returned 15 records for Maya, all with integer cents and matching ownership. No model calls or refund writes occurred. `AUTO_MIGRATE=false`; no migrations or seeds ran. Stopped the verification container after the checks; it remains stopped for inspection. Sanitized evidence is saved in this chat's `outputs/docker-verification.json`. This verifies Docker plus Neon locally, not a Render HTTPS deployment.

## 2026-10-27 — Public Render deployment verified

**Problem.** Establish a real HTTPS portfolio demo, rather than inferring hosting success from a local Docker run.

**Deployment.** After the user imported private environment variables, verified required variable names without exposing their values, the $0 Free plan, service name and `/api/health`. Deployed `cea784a42feffc8a2660d1b3b3bae017bc5cc3f2` from the public repository. Render service `srv-dbgf08mi0phs73el26u0`, deploy `dep-dbgf096i0phs73el28b0`, became Live on October 27 at approximately 2:42 PM America/New_York. Public URL: https://resolve-payments.onrender.com/payments. The existing Neon database is the only database; no paid compute, Vercel or hosted Supabase was provisioned. Migrations remain disabled for this already-migrated deployment.

**Measured result.** Independent HTTPS requests returned 200 for health, customers, scoped payments and the refund queue. Health reports `ok` and mock payments; 20 customers and 15 Maya payments loaded, with matching customer ownership and integer-cent amounts. Browser verification loaded the dashboard and opened the Northstar $84.99 payment detail with both matching references, refund history and the warning that matching records are not proof. A separate production Neon read reported 20 customers, 300 transactions and zero mock executions. No model request, approval, migration or seed was executed during these checks. Sanitized API evidence is saved in this chat's `outputs/render-verification.json`.

**CI and limits.** GitHub Actions run `40561931803` passed on the deployed commit: 131 tests, type check, 40 dev/16 holdout validation, default production build and migration bundle. Render Free may sleep and show a cold start of 50 seconds or more. The live AI provider was not retested on the public host; the existing partial evaluation reports remain the source of model evidence, and no holdout accuracy is claimed. Current README images predate the final palette; the live app is the current interface. Recorded/narrated media and career deliverables remain separate unfinished work.

## 2026-10-27 — Media script and storyboard prepared

**Problem.** Prepare portfolio media without representing the partial AI evaluation as completed accuracy or implying that the model approves refunds.

**Approach.** Read the requested upstream `brag-slim` skill directly without installing it. Drafted a 158-word, nine-paragraph walkthrough in `docs/media/walkthrough-narration.txt`, in problem → demo → architecture → measured results order. Prepared a 20-second, 120 BPM/40-beat launch storyboard and explicit capture/finishing rules. Planned actual read-only dashboard/detail/unsent-draft usage, with no model or refund writes; any future recorded response must be visibly labelled.

**Verified prerequisites and limits.** ffmpeg, ffprobe, Pillow, numpy and system Chrome are available. The checked Python environment lacks Playwright and Whisper; standard Node CDP can avoid a browser-library installation, while word-timestamp transcription still needs an approved local Whisper setup. No new packages, paid calls, audio generation, commits or pushes were made. Narration has not been supplied; no final GIF, poster, narrated MP4 or launch MP4 is claimed. Source media links remain unchanged until new assets exist and pass visual/audio QA.


## 2026-10-27 — Approved local Whisper setup

**Problem.** Narration alignment and final-audio checks require local word timestamps; Whisper was missing.

**Fix.** After explicit user approval, installed `openai-whisper` 20250625 into the isolated sibling `work/media-whisper-env`, leaving application dependencies and system Python unchanged. Cached the `base.en` model under `work/media-whisper-models`; used the system trusted CA bundle for its download. No paid transcription service was called.

**Measured result.** `pip check` found no broken requirements. Whisper imported and loaded `base.en` successfully on CPU with PyTorch 2.14.1; inspected its transcription signature to confirm the word-timestamp option. Saved the environment package versions in `work/media-whisper-requirements.txt`. No narration file is available yet, so transcription quality, final timing and audio-gap verification remain unmeasured. No commit or push was made.

## 2026-10-27 — Finish evaluation before recording

**Problem.** The user requires the end product and evaluation to be complete before final recording. Rerunning all cases wastes allowance, and recreating a deleted evaluation branch could silently provide a fresh budget counter despite earlier same-day allocations.

**Evidence.** Production's global daily allocation is 437,555 microUSD; the preserved isolated baseline allocated 4,463,770. Combined 4,901,325 of the unchanged 5,000,000 allowance is accounted for on October 27 UTC. The next turn was blocked. No additional model call was made; the next UTC-day reset is October 27 at 8 PM America/New_York. Allocations are conservative accounting allowances, not an assertion of provider charges.

**Fix.** Added `--remaining-from` with comma-separated compatible report paths. It excludes completed passes and completed scoring failures, retrying only missing/skipped/infrastructure cases. Rejects incompatible split/hash/model/provider and duplicate/unknown report case IDs. Each continuation writes a separate batch report; aggregate outcome claims still require an auditable ledger and matching prompt/scorer/fixture hashes. Added regression tests for failed-case preservation and report compatibility. Added the completion checklist and a holdout label review sheet; labels remain author-reviewed rather than independently human-validated.

**Measured result and continuation.** All 133 key-free tests, type checking and both split validations passed. Final targeted continuation tests and type checking were repeated after multi-report support. No spending limits or production data were changed. The user explicitly authorized a daily 8:05 PM America/New_York continuation; automation `finish-payment-agent-evaluation` was created with unchanged-budget, persistent-isolation and no-cherry-picking instructions. Final recording stays paused. No new commit/push was made, and the deployed app remains on its verified revision.

## 2026-10-28 — First scheduled continuation completes 14 more development cases

**Problem.** Tenable measurement required continuing unfinished cases after the allowance reset without rerunning prior passes or resetting budget state.

**Fix.** Confirmed zero current-day production allocations and created persistent isolated branch `br-summer-bonus-b5us8mp6`. Ran the unchanged model/scorer/fixtures against only the original baseline's 24 unfinished cases using `--remaining-from`. Saved code/dataset hashes and retained the branch for subsequent days.

**Measured result.** New report `67969605-12a7-4927-a2fb-b36003c672f1`: 14 model-backed passes, one daily-budget-blocked case and nine skipped cases. Independently verified the persisted report and 4,868,505/5,000,000 microUSD daily allocation. No further model calls after the block. Combined compatible-case ledger: 30/40 development cases completed, comprising 22 model-backed passes and eight guard passes; zero completed scoring failures, ten unfinished. This is not holdout accuracy. Fixture cleanup confirmed zero evaluation customers/transactions and zero mock executions. Detailed evidence and next-batch instructions are in `docs/evaluation-continuation-20261028.md`. No commit/push, dependency install, production reset or final recording occurred. The next daily continuation remains scheduled; holdout/product/media gates remain open.

## 2026-10-28 — Reconcile unused model-turn reservations

**Problem and cause.** Both recent evaluation runs stopped at the application's daily allowance, not a new Gemini quota error. The server reserved a worst-case amount before each turn and never released unused allowance after known successful usage. This made the safety guard consume far more allocation than its reported usage estimates. Vidcite's local limiter defaults to off; it does not use this per-turn reservation mechanism.

**Fix.** With the user's explicit approval, added versioned migration `0005_budget_settlement.sql` and application settlement after normal stream exhaustion. A single valid completion with positive input usage can settle to the same configured token-rate estimate, provided it fits within the original reservation. Gemini already includes reasoning tokens in output usage. Errors, cancellation, invalid/missing usage and ambiguous completion retain the reservation. Settlement errors fail closed. SQL keeps original amounts immutable, serializes on the same day bucket lock as reservations, handles retry/conflict safely, and credits only the original reservation day. Anonymous callers cannot settle. No cap, price rate, provider, model or prompt was changed; no old reservations were retroactively credited.

**Validation.** Added unit coverage for success, failed/cancelled streams after usage, invalid/zero/excessive/duplicate usage, and settlement storage failure. Added real Neon tests for repeated/concurrent settlement, conflicting replays, reserve idempotency after settlement, cap enforcement, unauthorized calls and original-day credit. Type checking and the production Webpack build pass; all 137 key-free tests passed. Final isolated-Neon integration run passed all 33 tests. A synthetic-turn/real-SQL check completed ten turns within an unchanged 200,000-microUSD test cap, retaining 9,000 microUSD after settlement; unreconciled reservations would have blocked the second turn. This is accounting behavior, not a live-model quality or billing result. No live Gemini requests were made and production was not migrated or deployed. This accounting change affects allocation/coverage and must be identified in subsequent evaluation campaign provenance; it is not evidence of improved model accuracy.


## 2026-10-28 — Budget settlement rolled out after approval

**Action.** The user explicitly approved commit, push and deployment. Applied only the pending versioned migration 0005 to production, without seeding/resetting data. Independent Neon verification confirmed migration presence, 20 customers, 300 transactions, zero mock executions and no anonymous settlement permission. Secret review passed for all staged files. Pushed `9124116` under the requested author identity; unrelated media drafts stayed uncommitted.

**Measured result.** CI run `40730283733` passed. Render deployment `dep-dbh2gubl550s73eq0blg` reports Live on `9124116` at approximately 12:55 PM America/New_York. Independent HTTPS health/customer/payment checks passed (20 customers, 15 Maya payments), and the public dashboard loaded. Sanitized evidence is saved in this chat’s `outputs/budget-fix-rollout.json`. No provider/model/rate/cap change, extra model request, or refund write occurred. Historical reservations remain unchanged; subsequent normally completed calls can release unused allocation. The remaining development/holdout evaluation is still incomplete and the scheduled continuation must record this accounting change in its campaign provenance.
