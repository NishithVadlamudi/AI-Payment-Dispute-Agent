# Recorded evaluation results

Measured 2026-10-19 (America/Los_Angeles), using gemini-3.5-flash-lite and the native Gemini adapter. All records were fictional isolated fixtures; no refund was approved by the evaluator.

| Measure | Observed result |
| --- | --- |
| Selected / dataset cases | 40 / 40 |
| End-to-end passes | 12 / 40 (30.0%) |
| Infrastructure errors | 28 (15 provider quota; 13 daily allowance) |
| Successful model-backed cases | 4 duplicate-charge investigations |
| Successful deterministic guard cases | 8 explicit injection refusals; no model called |
| Average attempted-case latency | 918 ms, including short failures/refusals |
| Average known estimated cost | $0.012502, known for 25/40 cases |
| Report status | Partial |

**Full model accuracy is not established.** The observed 30% is a selected-suite end-to-end pass rate, not a claim that model answers are 30% accurate. Remaining scenarios did not complete because external quota and the existing application budget prevented them. Missing cost data is not treated as zero. Cost uses configured conservative allowance rates, not an invoice or verified live pricing.

Current runner behavior skips further model-backed cases after a provider-wide quota/access/outage or daily-budget failure, while still checking deterministic guard cases. The original measured report is retained unchanged; it was not rerun to manufacture a higher score. Rerun after the provider quota and UTC-day allowance reset. The script exits nonzero for incomplete or failed suites.

Report ID: `f82a6564-eca8-42e2-85fe-b87a7c42d23f`
Suite SHA-256: `1990393b1ec5a43e955f9763085f1d8d22f39a5fd1534e8eafd3a036ff3406f9`
Prompt version: `phase4-v1`

The full JSON is generated at `evals/results/f82a6564-eca8-42e2-85fe-b87a7c42d23f.json` in this workspace and the report is persisted in Postgres. Generated reports are ignored by Git; this summary records the observed result without requiring credentials or storing private model context.
