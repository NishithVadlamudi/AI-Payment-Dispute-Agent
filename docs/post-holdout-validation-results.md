# Post-fix targeted validation — completed with one failure

## 2026-10-29 continuation: all six cases now have completed outcomes

Report `b968bbeb-4a66-4c7c-9876-371e39429dc9` selected only the three unfinished cases using `--remaining-from` with the original report. Dataset, prompt, tool definitions, scorer, fixture source and implementation hashes still match the freeze. Two passed; **one completed scoring failure must remain a failure and must not be retried until passing**. Combined coverage is **5/6 automated and manually reviewed passes, one failed answer**, with the earlier infrastructure attempt retained separately.

- Expiry decline: passed; actual answer correctly gave $101.40, expired card and a valid replacement-card next step, without cents arithmetic.
- Balance decline: failed; tools successfully retrieved the $129.00 insufficient-funds payment and the correct decline reference, but the final answer was only `₀`. The provider reported a normal completed response with one output token on its final turn. This is an unusable model answer, not infrastructure loss, budget exhaustion or a successful investigation. The local loop currently accepts any nonempty text as an explanation; that permits this answer to appear transport-successful even though the scorer correctly rejects it. The evidence supports those observations, not a definitive upstream cause.
- Receipt: passed; actual answer correctly gave Green Market, $163.38 and succeeded status with no write request.

This batch had zero infrastructure errors, no retries and estimated configured cost 121,775 microUSD. Independent Neon verification confirmed that same-day retained allocation was 121,775 of the unchanged 5,000,000 cap, with zero evaluation customers, evaluation transactions or refund executions remaining. Evidence is saved in the chat's `outputs/regression-continuation-results.json`. The original partial report below is preserved as history. Do not rerun any completed case, including the failure. Product completion and final recording remain gated on handling unusable output and fresh validation; do not claim six passing cases.

## Historical first batch — 2026-10-28

### Subsequent local handling fix (outside frozen measurements)

After preserving and closing the campaign, the loop now requires at least one Unicode letter in a final explanation. Empty, symbol-only or numeric-only output produces an explicit incomplete-investigation error and returns without a successful `done` event. It does not fabricate an answer, retry the provider, or validate factual correctness. This narrow check would catch the observed lone `₀`; it is not a semantic-quality guarantee. Five added regression cases cover four unusable outputs and a valid non-Latin explanation. **146 key-free tests and type checking pass.** No live cases were rerun after this change; fresh reviewed validation is still required. Historical measured hashes/results remain unchanged.

Report `964bde3e-a003-4e06-a2b6-70f612886e71` uses the six user-approved cases in `evals/regression.json`, frozen before inference. This is targeted regression evidence, not an untouched general-accuracy holdout. The original development and holdout reports remain unchanged.

| Case | Observed outcome |
| --- | --- |
| Processing refund, neutral question | Automated and manual pass; $65.00, processing, policy timing, no approval instruction or new request |
| Processing refund, mistaken approval assumption | Automated and manual pass; explicitly corrected the assumption and distinguished processing from human approval |
| Completed refund | Automated and manual pass; $42.00 and succeeded/completed, no further action or new request |
| Expiry decline / $101.40 | Infrastructure failure: provider temporarily unavailable; no final answer |
| Balance decline / $129.00 | Skipped after shared provider failure; no model call |
| Read-only receipt | Skipped after shared provider failure; no model call |

Three cases completed successfully; one attempt failed in infrastructure and two cases were skipped. The CLI's 3/6 end-to-end coverage is not model accuracy. Currency guidance is not yet validated on the three outstanding scenarios. The provider error exposed to the application was generic unavailability; this is not proof of a quota exhaustion or a particular reset time.

No retry was attempted. Under the existing continuation rules, stop further model calls for the current UTC allowance period and resume only unfinished cases after the next period, using `--split regression --remaining-from evals/results/964bde3e-a003-4e06-a2b6-70f612886e71.json` and any later compatible reports. Keep the frozen implementation, cases, provider, model and limits. Never rerun the three completed outcomes to improve a score. The next UTC day begins October 29, 2026 at 00:00 UTC (October 28, 8 PM America/New_York); that is an accounting boundary, not a guarantee of provider recovery.

## Provenance and verification

The chat's `outputs/regression-freeze-manifest.json` records pre-inference hashes, and `outputs/regression-postrun-hash-check.json` verifies executable/data hashes remained unchanged. The review document's approval-status wording was updated after freeze without changing prompts or expected outcomes. `outputs/regression-results.json` preserves the full report, sanitized final answers/tool traces, budget and independent cleanup query.

All calls used existing isolated Neon branch `br-summer-bonus-b5us8mp6`, Gemini `gemini-3.5-flash-lite` and unchanged limits. Independent Neon verification found zero evaluation customers, zero evaluation transactions and zero refund executions after cleanup. Daily retained allocation was **2,003,130 / 5,000,000 microUSD**; failed/uncertain reservation allowance was retained. The cap was not the observed blocker. These are application estimates, not a provider invoice. Production records were not reset or changed by these checks.

Local checks: **141 key-free tests passed** and type checking passed. The production build passed with Webpack in the preceding fix verification; default Turbopack was blocked by sandbox worker-port restrictions. Current fixes and evidence are local, uncommitted and undeployed. Final recording remains gated on outstanding live validation and deployment verification.
