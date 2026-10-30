# Interview stories

## 1. Hardest bug: reservation accounting
**Situation:** Conservative model-turn reservations were retained even after successful calls, blocking evaluation before the unchanged daily allowance was actually consumed.
**Task:** Complete the measurements without bypassing budget controls.
**Action:** Reserved before each call, settled only validated completed usage, retained uncertain failures, and audited 34 historical reservations against 34 nonoverlapping trace steps before recovering 33 known successful allocations.
**Result:** All 40 development cases completed across preserved batches; the configured 5,000,000-microUSD cap stayed unchanged. These are accounting estimates, not provider invoices.
**Evidence:** docs/development-evaluation-complete.md; docs/first-run-notes.md, settlement/recovery entries.

## 2. Design trade-off: human authority
**Situation:** A model can suggest a refund, but its text cannot authorize money movement.
**Task:** Keep a useful agent workflow while protecting the mock ledger.
**Action:** Exposed five scoped tools, including request_refund, and kept approval/execution behind database rules and a separate reviewer action. Used integer cents, row locks and unique execution keys rather than relying on prompt instructions.
**Result:** Two concurrent approval requests produced exactly one mock execution in isolated Neon verification. The public app never connects to a real payment processor.
**Evidence:** docs/first-run-notes.md, Phase 1 end-to-end HTTP check; supabase/migrations/0002_refund_approvals.sql.

## 3. Negative result: passing the rubric was insufficient
**Situation:** The frozen 16-case synthetic holdout passed all automated checks.
**Task:** Determine whether the customer-facing answers were actually ready.
**Action:** Read the answers and found two approval-state confusions plus two money-presentation problems. Preserved the report, retired the holdout for improvement claims, and measured later fixes separately.
**Result:** A six-case targeted campaign produced five passes and one genuine unusable answer; that failure remains documented. A later fresh three-case smoke set passed, without rewriting the earlier score.
**Evidence:** docs/holdout-results.md; docs/post-holdout-validation-results.md; docs/output-handling-validation-results.md.

## 4. Scaling: what breaks first
**Situation:** The demo runs on one Render Free service with Neon and a private PostgREST adapter.
**Task:** Avoid claiming production-scale reliability from a small demo.
**Action:** Used database-backed rate/budget coordination, a bounded eight-step loop and loopback-only adapter access. Documented public fictional reviewer access, free-host cold starts and partial account views.
**Result:** Production contains 20 customers and 300 payments; a historical public investigation took 73,381 ms, while the latest balance-limit smoke check took 7,808 ms; these individual runs do not establish a latency distribution. Scaling would require stronger authentication, queueing and provider-reliability work, not just a larger web instance.
**Evidence:** docs/provider-debugging.md; docs/free-deployment.md; docs/responsive-workspace.md.

## 5. Answer boundary: separate planning from explanation
**Situation:** Model prose could contain planning-style text despite correct payment tools.
**Task:** Make the customer answer depend on validated records while keeping Gemini tool choice.
**Action:** Replaced arbitrary final prose with a scoped evidence renderer. Fresh frozen qualification completed 22 model outcomes and two guards; full-answer review passed 21/22 model cases and found an unclear balance-limit explanation. Added explicit bound and no-request wording without changing the recorded score.
**Result:** 194 key-free tests pass; all 22 recorded traces pass deterministic replay after the fix, and a separate public check verifies the deployed wording. Replay is not fresh model accuracy. With more time I would expand independent labels, reviewer authentication and actual Safari-device coverage.
**Evidence:** docs/evidence-qualification-results.md; docs/first-run-notes.md.
