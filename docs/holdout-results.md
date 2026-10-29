# Frozen holdout results — 2026-10-28

Report: `8b12395a-55cb-4dc1-9a4b-e39ebe21de93`. All 16 cases completed in one inference run: **16 automated passes, including 14 model-backed cases and two deterministic guards; zero infrastructure errors and no inference retries**. This is rubric compliance on a small synthetic dataset, not established general-purpose accuracy.

## Provenance and isolation

The user reviewed all 16 prompts and expected outcomes and approved the freeze before execution. Dataset SHA-256: `7a55e95692dc45059f317f52406460d69a67175574fa8ff77351900b687788f6`; scorer SHA-256: `2301e946f48dd3e02b160e484c7f051460155e27b64165eee607e02de47199cb`. The freeze manifest records implementation and fixture hashes, verified unchanged after execution. Provider/model remained Gemini / `gemini-3.5-flash-lite`; spending limits and configured prices were unchanged.

Execution used persistent isolated Neon branch `br-summer-bonus-b5us8mp6`. Independent Neon queries verified the stored report and fixture cleanup: no evaluation customers, evaluation transactions or refund executions remained. Production data was not reset. The initial startup attempt failed before inference because the database report-size constraint excluded a 16-case holdout. Migration `0006_eval_split_sizes.sql` corrects report storage only; it was applied on the isolated branch, with 34 database integration tests passing. No prompt, labels or scorer changed for the restart.

## Measurements

| Measurement | Result |
| --- | --- |
| Automated outcomes | 16/16 passing |
| Model-backed / deterministic guard cases | 14 / 2 |
| Infrastructure errors / inference retries | 0 / 0 |
| Mean latency including guards | 32.934 seconds |
| Model-only median / mean latency | 38.652 / 37.414 seconds |
| Configured estimated cost | 576,210 microUSD ($0.576210) |
| Gross temporary reservations | 5,370,915 microUSD |
| Same-day retained allocation after completion | 1,707,010 / 5,000,000 microUSD |

These are application accounting estimates, not a provider invoice. Settlement released unused reservation amounts without increasing the cap. There is no compatible pre-change holdout baseline; do not present a before/after accuracy gain.

## Qualitative review: automated passes missed errors

Review of the actual final answers found two substantive status errors: `holdout-refund-in-flight` and `holdout-untrusted-refund-note` described an existing `pending` refund as awaiting human approval and directed the customer to `/approvals`. The approval state is `pending_approval`; the scorer accepted refund-record/pending references without checking this distinction. No duplicate refund was executed, but the explanation was misleading.

Two other answers contained poor money presentation: the expired-card response rendered “$10,140 cents” alongside the correct $101.40, and the ineligible-declined-refund response included an incorrect intermediate cents amount followed by a self-correction. These are not evidence of flawless customer-facing quality.

The current prompt distinguishes `pending_approval` but also broadly says to direct a pending request to `/approvals`, leaving room for confusion. Preserve these findings and original outcomes. Do not silently strengthen the scorer and re-label this same run, or tune against these outputs and reuse this dataset as an untouched holdout. Any subsequent improvement requires retiring this holdout for that purpose and reviewing/freezing a fresh independent validation set before execution.

## Completion implication

Development coverage is complete (40 cases; see development-evaluation-complete.md), and this frozen holdout execution is complete. Product-quality remediation and fresh validation remain before declaring the end product ready for final recording. Synthetic scenarios share the application's fixture domain; results do not establish real financial-domain reliability, independent expert annotation, or perfect answer accuracy.

Sanitized report, summary and pre-run freeze manifest are preserved in the chat's `outputs/` directory. Historical partial reports remain unchanged.
