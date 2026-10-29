# Evaluation protocol, version 2

## Split and provenance

- **Dev:** `cases.json`, the existing 40 exercised cases. Keep their content unchanged so the original suite hash and partial report remain reproducible. These cases are not an unseen holdout.
- **Holdout draft:** `holdout.json`, 16 new manually authored prompts with explicit expected tools, transaction IDs, amounts and outcomes, created on 2026-10-27 before any version-2 model tuning. Labels are derived from the deterministic seed fixtures and existing refund rules, not generated model answers. They await independent human review; do not describe them as user-validated gold labels.
- The holdout varies wording but shares seed scenarios with dev. It measures generalization to new phrasing and evidence handling within this demo, not unseen merchants, real financial data, or broad banking accuracy. Future independent scenarios are needed for stronger claims.
- Do not tune on holdout outputs. Record the code commit, prompt version, provider/model and suite SHA-256 before running it. If a holdout result motivates a fix, retire those cases into development and create a new holdout for subsequent claims.

## Holdout composition

| Category | Count | Gold requirement |
| --- | ---: | --- |
| Duplicate charge | 2 | One eligible 8,499-cent pending approval request; no claim of execution |
| Decline explanation | 3 | Read the scoped payment and explain its actual stored decline code |
| Existing refund | 2 | Read the refund evidence; distinguish pending from completed; no duplicate request |
| Receipt only | 1 | Inspect the payment, explain status, make no refund request |
| Missing/foreign ID | 2 | Scoped not-found evidence; no successful refund request |
| Ineligible refund | 2 | Inspect the target; create no refund on an unsettled or over-balance request |
| Explicit override | 2 | Deterministic refusal without model/tool activity |
| Untrusted database text | 2 | Treat stored injection text as data; answer from payment/refund evidence |

Regex answer checks are coarse concept checks, not full semantic grading. Exact tool outputs and database safety tests provide stronger evidence than matching a phrase. Review full traces for correctness, relevant evidence, safe next steps, and any unsupported claims; report human review separately from automated passes. The refusal cases intentionally exercise a narrow explicit-override guard and do not establish comprehensive injection resistance.

## Key-free checks

```bash
npm test
npm run typecheck
npm run build
npm run eval:validate
npm run eval:validate -- --split holdout
```

Validation checks structure, unique IDs and regex syntax. Tests also check dev/holdout prompt separation and fixture ownership. Neither measures model performance.

## Live procedure (explicit approval required)

1. Use a disposable Neon branch and its private PostgREST adapter. Never change the production connection or increase budget settings to make an evaluation finish.
2. Record available provider quota and application allowance. Run dev first (`npm run eval -- --split dev`), at most one controlled change at a time. Live calls consume quota and may cost money; obtain approval first.
3. Freeze the implementation and independently review the holdout labels, then run `npm run eval -- --split holdout` once. Do not treat a partially selected run (`--case` or `--limit`) as a full-split result.
4. Preserve report IDs and hashes. Stop on provider-wide or daily-budget limits; do not retry until allowance is available. Fixture cleanup failures stop the run to preserve evidence.
5. Report successful cases, failed cases, skipped cases and infrastructure failures separately. Show attempted-case latency and known-cost coverage; unknown cost is not zero. Give the selected-suite end-to-end pass rate with its denominator and completion status, not a model-accuracy headline.

For a later allowance period, `--remaining-from evals/results/<prior-report>.json` selects only infrastructure-blocked, skipped or missing cases. For several batches, supply **all** compatible prior report paths separated by commas. Completed scoring failures are retained and excluded from retry selection, just like completed passes. Each continuation saves a new batch report; this is not an automatic merged full-suite result. Keep prompt/scorer/fixture hashes unchanged across a measurement campaign, and maintain an auditable case ledger before reporting complete-suite results. Do not use new Neon branches to reset the same-day allowance; see `docs/completion-checklist.md`.

The existing partial report in `docs/evaluation-results.md` remains unchanged. Version-2 scoring adds a successful target-payment evidence requirement for receipt, blocked-request and decline cases; its scores cannot be compared directly with the earlier scoring version as an improvement in the model.

## Current status

The original partial version-2 baseline is preserved in [evaluation-baseline-v2.md](../docs/evaluation-baseline-v2.md). Subsequent audited continuations now complete all 40 development cases: 32 model-backed passes and eight guard passes. [Completed campaign evidence](../docs/development-evaluation-complete.md) retains the original blocked/skipped attempts and one provider timeout; only infrastructure cases were retried. During the development campaign no agent prompt, provider/model, token rate or daily cap changed; reservation accounting was corrected and historical successful allocations were recovered with an exact audit. Do not publish before/after model-accuracy improvement claims. The subsequently approved holdout and its qualitative findings are recorded below.

### Completed frozen holdout

The 2026-10-28 run completed 16/16 automated outcomes (14 model-backed, two guards), without infrastructure errors. [Qualitative review](../docs/holdout-results.md) identified status and money-presentation issues missed by the scorer. Do not call this perfect accuracy or reuse this holdout for improvement claims after tuning.

### Targeted post-fix regression

`npm run eval:validate -- --split regression` validates the six approved targeted cases without model calls. Live execution uses the same CLI with `--split regression`; only use the persistent isolated Neon branch. [Current results](../docs/post-holdout-validation-results.md): all six cases have completed outcomes across two batches—five automated/manual passes and one genuine unusable-answer failure. The earlier provider failure and skipped attempts remain preserved. No unfinished cases remain; do not rerun the completed failure until passing or relabel it as infrastructure. Further changes require fresh frozen validation.

### Fresh output-handling smoke checks

The user authorized fresh validation after unusable-output handling was added. --split validation reads separately frozen evals/validation.json. [Fresh results](../docs/output-handling-validation-results.md): three automated/manual passes, no retries or infrastructure errors. Preserve the earlier 5/6 campaign and its failure; this is not an untouched holdout or an accuracy improvement.
