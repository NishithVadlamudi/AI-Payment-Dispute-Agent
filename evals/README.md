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

The existing partial report in `docs/evaluation-results.md` remains unchanged. Version-2 scoring adds a successful target-payment evidence requirement for receipt, blocked-request and decline cases; its scores cannot be compared directly with the earlier scoring version as an improvement in the model.

## Current status

A partial version-2 development baseline is recorded in [evaluation-baseline-v2.md](../docs/evaluation-baseline-v2.md): eight model-backed passes, eight guard passes, one budget-blocked case and 23 skipped cases. No holdout result has been measured. No agent prompts, provider/model choices or budget settings have been tuned in this phase. Do not publish before/after accuracy or improvement claims until comparable completed measurements exist.
