# Development evaluation completed across audited batches

Measured October 27–28, 2026. All **40 development cases now have completed passing automated outcomes**, comprising 32 model-backed cases and eight deterministic explicit-override guard cases. This is the exercised development set, not holdout accuracy or a claim of general financial correctness.

| Report | Newly completed passing outcomes | Preserved infrastructure outcomes |
| --- | ---: | --- |
| `6844bf0a-d470-4863-8116-80750a726dde` | 16 (8 model, 8 guard) | 1 budget-blocked; 23 skipped |
| `67969605-12a7-4927-a2fb-b36003c672f1` | 14 model | 1 budget-blocked; 9 skipped |
| `2a957104-8ed6-4577-bbd6-83b0fbad4504` | 9 model | 1 provider-response timeout |
| `84b7c431-2918-4e6c-85cd-63e43d83d301` | 1 model | None |

Each case has exactly one completed, infrastructure-free result in the combined ledger. Completed scoring failures would have been preserved and excluded from retries; none occurred. The final retry selected only the timeout case, `pending-payment-refund`, with the unchanged prompt and settings; it passed in 29,560 ms. The failed 146,442-ms attempt remains in its original report. Percentages from the individual batches are not averaged.

The dataset hash remains `1990393b1ec5a43e955f9763085f1d8d22f39a5fd1534e8eafd3a036ff3406f9`, scorer hash `2301e946f48dd3e02b160e484c7f051460155e27b64165eee607e02de47199cb`, model `gemini-3.5-flash-lite`, prompt version `phase4-v1`. No prompt/model/scorer tuning occurred. Seed fixture source is unchanged; generated dates follow the UTC day, so this is a multi-day campaign over equivalent relative-date scenarios, not bit-identical dated inputs.

## What enabled immediate completion

The daily cap and configured token rates were unchanged. The settlement fix was deployed, and old successful-step reservations were recovered only after a full exact one-to-one audit on the isolated branch: 34 reservations, 34 allocated steps, non-overlapping run intervals, exact reserved-amount matches and equal totals. Thirty-three successful-run steps had valid token counts and matching configured-rate cost estimates. Their 4,220,830 microUSD unused allowance was settled through the tested function in a locked transaction. The failed run's reservation was retained. Original reservation amounts, traces and reports were not rewritten.

After this recovery and the final calls, an independent Neon connection reported **1,130,800 / 5,000,000 microUSD** allocated for the UTC day. That includes retained uncertain/failed usage; it is accounting allocation, not a provider invoice. No new project, replacement branch, counter reset, paid upgrade or cap increase was used.

Report persistence was independently checked. Fixture cleanup left zero evaluation customers, zero evaluation transactions and zero mock refund executions on persistent branch `br-summer-bonus-b5us8mp6`. Production payment/refund records were not modified by this work. Complete per-attempt provenance and the recovery mapping are saved in this chat's `outputs/development-case-ledger.json` and `outputs/reservation-recovery-audit.json`.

## Remaining gate

The user subsequently approved the rubric and the frozen 16-case holdout completed; see [holdout results](holdout-results.md) for automated outcomes and substantive qualitative limitations. That holdout is retired for improvement claims following guidance fixes. Do not rerun completed development cases merely because an automation fires. The original partial reports remain historical evidence and are not relabelled as successful single-run results. No before/after model-accuracy improvement is claimed.
