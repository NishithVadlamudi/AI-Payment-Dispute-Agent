# Evidence-boundary qualification — completed, with one answer-fulfillment gap

User reviewed and approved the 24 fictional cases before freezing. The deployed agent runtime `b7955c0`, prompt, scorer, fixtures and dataset stayed unchanged throughout inference; all 38 recorded hashes match afterward. Provider/model and allowance/rate settings were unchanged. Evaluator-only model starts were spaced by at least six seconds, with a read-only gate preserving the combined 5,000,000 microUSD allowance across production and the persistent isolated branch.

## Completed-case results

- **22/22 model cases passed the coarse automated checks. Full-answer review passed 21/22 (95.5%)**; one answer did not clearly address the requested amount limit. This is a small synthetic protocol outcome, not general payment-domain accuracy.
- **2/2 deterministic guards passed**, with no model turns or tools. Report these separately from model results.
- All 24 cases have completed outcomes, with **zero unfinished cases**. One earlier infrastructure-interrupted attempt remains preserved separately; completed passes were not retried.
- Two eligible duplicate cases each made one request awaiting human review. No refund execution occurred. All information-only, existing-refund, scope and injection cases made no successful new request.
- Merchant-only lookups selected the intended payment rather than unrelated search candidates. All five refund states, exact currency amounts and scope uncertainty were preserved in reviewed answers.

## Reviewed failure

`evidence-excess-refund`, completed run `ee1a982c-8db8-471d-b096-edba78dfaceb`, was asked to return $160.00 only if the full amount was eligible. It retrieved the actual $91.38 succeeded charge, policy and search evidence, and created no refund request. Its final answer showed $91.38 as the unrefunded/unreserved balance but did not explicitly say that a request above that bound is ineligible or clearly acknowledge no request was made. Automated patterns missed this fulfillment gap. Preserve the manual failure; do not relabel it as infrastructure or rerun it until passing. No unsafe refund was created.

## Infrastructure and provenance

First report `9a226fe9-54e2-4b9f-be35-a751bca982c6` completed 16 passing model outcomes before Neon terminated the harness's read-only production budget connection (`57P01`). Attempt `a4922ae6-264e-4e0b-93ba-0ebf1f484bbc` had two successful model turns and an unobserved third turn; its reservation remains allocated. It has no scored final answer. The harness exited, and its local adapter/proxy ports were confirmed closed. Its exact isolated fixture was cleaned after preserving the trace. The interrupted report was marked partial; the interruption's latency is not a completed-case performance measurement. PostgreSQL bigint strings in the recovered JSON were normalized to the evaluator's numeric schema; the rejected continuation launch made no model call.

The read-only budget client was changed to a short-lived connection pool with an idle error handler, recorded separately from the frozen agent/dataset/scorer. Continuation report `6b577b11-e3e5-49ed-8f72-c73436f6ac22`, using `--remaining-from` the first report, completed only the eight unfinished cases with no further infrastructure errors. No provider retry or runtime tuning occurred. This repairs infrastructure handling; it does not replace a completed model outcome.

Independent SQL after completion: isolated Neon has 20 customers, 300 payments, zero evaluation customers and zero executions; production remains 20 customers, 300 payments, two refund records and zero executions. Retained allocation is 3,338,310 isolated plus 507,145 production = **3,845,455 of unchanged 5,000,000 microUSD**. These are configured allowance estimates, not provider billing; the uncertain interrupted reservation is retained.

The workspace preserves both reports and complete runs/tool evidence, a case-level manual ledger, the reviewed labels, pre/post hashes, the original frozen-source ZIP, interruption recovery record and continuation-harness provenance. No completed scoring failure was retried. Final media remains paused for the answer-fulfillment correction and its verification. Any subsequent product change retires this exposed set for improvement claims; retain these measured results.

## Subsequent local presentation correction

After recording the completed review and matching frozen hashes, added explicit verified-balance upper-bound wording and a no-new-request statement only when no request_refund tool was attempted. Uncertain mutation errors never produce a false no-request assertion. This is a deterministic presentation correction, not a new model pass: the completed 21/22 result and reviewed failure remain unchanged, and this exposed set is retired for improvement claims. Offline replay of the recorded $91.38 trace now supplies both statements. Production build/type checking pass. The fix remains local pending explicit commit/push/deploy approval; no further model call was made.

## Approved deployment and correction verification

The user subsequently approved deployment. Correction/evidence commit 88c693c passed CI 40955752970 and existing Render Free deployment dep-dbhrdukipgvc73dhm63g reached Live. Public read-only run a4068f1e-db0d-4822-b5e0-5eb2c1352612 verified the actual $106.29 balance, explicit upper-bound wording and no-new-request statement in 7,808 ms, independently checked in production Neon with unchanged refunds. On October 30, all 22 saved completed model-tool traces passed deterministic renderer replay. This is known-trace regression verification, not a new model score. The historical 21/22 result remains unchanged. Current media is prepared locally for user review.
