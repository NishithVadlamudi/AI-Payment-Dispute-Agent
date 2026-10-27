# Version-2 development baseline — partial

Measured 2026-10-27 on an isolated live Neon branch with Gemini `gemini-3.5-flash-lite`, prompt `phase4-v1`, and unchanged application spending settings. This is the first development run under the tightened evidence scorer; it is not a holdout measurement or an improvement comparison.

| Measure | Observed |
| --- | ---: |
| Selected development cases | 40 / 40 |
| Completed model-backed passes | 8 |
| Deterministic guard passes (no model) | 8 |
| Case blocked by daily allowance | 1 |
| Subsequent model cases skipped | 23 |
| Completed cases failing outcome scoring | 0 |
| Selected-suite end-to-end passes | 16 / 40 (40%) |
| Attempted cases | 17 |
| Average attempted-case latency | 19,224 ms |
| Average estimated cost, across attempted cases including guard cases | 29,333 microUSD ($0.029333) |
| Cost coverage | 17 / 17 attempted cases |
| Total allocated allowance during this run | 4,463,770 microUSD |
| Holdout cases run | 0 / 16 |

The eight model-backed passes were four duplicate-charge investigations and four decline explanations (insufficient funds and expired card). Each duplicate investigation proposed one pending approval; no evaluator approved or executed a refund. The eight explicit-override guard cases made no model calls.

The ninth model-backed case was interrupted by the existing daily allowance, and further model cases were skipped. The report's `infrastructure_errors: 24` includes that one attempted failure and the 23 skipped cases. The runner exited nonzero as intended for a partial suite. Allocated allowance and estimated cost are distinct accounting measures; neither is a provider invoice. Guard cases contribute zero model cost and short latency, so the averages above are not averages of model responses alone.

Do not infer a model-quality improvement from 12/40 in the original partial report to 16/40 here. Coverage differs, the scorer is stricter, and both runs were incomplete. The new 16-case holdout draft was not run or used for tuning. Complete comparable evaluation requires available quota/allowance and independent holdout label review; do not raise spending limits to force completion.

Report ID: `6844bf0a-d470-4863-8116-80750a726dde`.

Suite: `payment-disputes-v2-dev`.

Dataset SHA-256: `1990393b1ec5a43e955f9763085f1d8d22f39a5fd1534e8eafd3a036ff3406f9`.

Neon branch: `phase2-eval-20261027` (`br-wispy-unit-b597ts1x`). Report persistence was verified through a separate Neon MCP SQL connection: partial status, 16 passes, 40 results, 24 infrastructure-error entries. The local JSON remains in ignored `evals/results/`; a user-facing copy and frozen-code manifest were saved in this chat's outputs. The temporary branch was subsequently deleted with the user's explicit approval; its database report is no longer available remotely.
