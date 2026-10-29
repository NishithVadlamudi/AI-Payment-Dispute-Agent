# Qualification: partial, output-quality failure and provider quota

Report `3b15c851-b7fd-42e1-bf9f-2e440c120e1a`, October 29, 2026. The user approved the fresh review before execution. All 36 frozen source/protocol hashes matched after the run. Existing Gemini model, limits and persistent isolated Neon branch were unchanged.

## Coverage and outcomes

| Measurement | Observed result |
| --- | --- |
| Completed model cases | 9 of 22 |
| Automatic passes among completed model cases | 9/9 |
| Full-answer/tool-contract reviewed passes | 8/9 |
| Genuine completed output-quality failures | 1 |
| Deterministic guards | 2/2 passing; no model calls |
| Provider-quota failed attempts | 1 |
| Skipped model cases after the shared failure | 12 |
| All-case automatic coverage | 11/24; not an accuracy score |

The partial reviewed proportion is 88.9% among only nine completed model cases (95% Wilson interval 56.5–98.0%). **This is not a completed qualification score or broad accuracy estimate.** The 13 unfinished model cases have no completed answer-quality outcome. The runner's `infrastructure_errors: 13` combines the one provider-failed attempt and twelve skips; it does not mean thirteen API requests failed.

Both refund proposals, four decline explanations and two receipt summaries passed full review. The pending-payment case returned correct payment facts and a correct no-refund decision, but included self-directed planning-style narration and stray text. That violates the frozen final-output quality requirement even though the coarse automatic checks passed. No refund was executed. The failure must remain a failure and cannot be retried into a pass.

## Why the existing boundary was insufficient

Source inspection confirms that the adapter excludes text explicitly tagged `thought: true`. The loop also buffers tool-turn text and checks final formatting. Nevertheless, this final no-tool answer contained planning-style text delivered through the ordinary text channel; it was neither an empty answer, a recognized prefix nor raw-cents formatting. Native raw provider chunks were not retained, so no stronger upstream diagnosis is claimed.

An offline replay of the retained answer and tool results reproduced successful release of that text with no network, model call or database write. Evidence: chat workspace `outputs/output-boundary-diagnostic.json`; replay source `work/output-boundary-diagnostic.mts`. A short prefix blocklist cannot guarantee a clean customer-facing explanation. The proposed stronger boundary is documented in [the answer-rendering proposal](evidence-answer-proposal.md); the user subsequently approved local implementation, verified separately in [the evidence-boundary checks](evidence-answer-verification.md).

## Provider and budget

The next model attempt returned HTTP 429, categorized as provider quota. All further model calls stopped immediately. Only deterministic guards ran afterward. Sanitized diagnostics do not identify whether the exhausted provider quota was per-minute, token-based or daily, so no exact provider reset time is established. The application UTC allowance boundary does not guarantee provider recovery. Do not retry in this allowance period or increase limits.

Known configured usage was 421,160 microUSD. The failed attempt's 142,975-microUSD uncertain reservation was retained. Isolated allocation increased from 1,313,890 to 1,878,025; adding production's 454,930 gives 2,332,955 under the unchanged 5,000,000 cap. The application cap was not the observed blocker. These are conservative application accounting estimates, not provider invoices.

Independent isolated Neon verification found zero evaluation customers, zero evaluation transactions and zero refund executions after cleanup. Production was not reset, seeded or modified by these cases.

## Evidence and next gate

The chat workspace retains `outputs/qualification-freeze-manifest.json`, `qualification-reviewed-frozen.md`, `qualification-postrun-hash-check.json`, `qualification-results-3b15c851.json` and `qualification-manual-review.json`, including full final answers and tool results. No source was changed during or after inference. The campaign remains partial. Continuing unfinished cases requires the exact frozen runtime and `--remaining-from evals/results/3b15c851-b7fd-42e1-bf9f-2e440c120e1a.json` plus any later compatible reports. A product redesign would require retiring this set for improvement claims and fresh reviewed validation rather than merging changed-runtime outcomes.

Final media, commits and deployment remain paused pending remediation and verification. Do not present the prior 18/22 release result, this partial sample and later fixes as one interchangeable current-version accuracy score.

## Subsequent approved design change

The user approved evidence-based final answers after this batch. The new implementation is local and verified offline/against isolated Neon, without model calls. This exposed set is now retired for improvement claims; do not resume its skipped cases on the changed runtime and merge results. Historical partial outcomes and the exact frozen-source archive remain preserved. See [implementation verification](evidence-answer-verification.md).
