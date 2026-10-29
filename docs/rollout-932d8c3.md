# Recovery fix: verified public rollout

On October 29, 2026, the user approved committing, pushing and deploying the bounded answer-recovery fix. Commit `932d8c36b75375e483dc4989420509f4d0079319` contains only the agent/provider changes, regression tests and recovery verification note. No secrets or media drafts were included.

GitHub CI [40926019779](https://github.com/NishithVadlamudi/AI-Payment-Dispute-Agent/actions/runs/40926019779) passed 160 tests, type checking, all four dataset validations, the production build and deployment bundle. Existing Render Free service `srv-dbgf08mi0phs73el26u0` deployed that exact commit successfully in `dep-dbhohue1egvs7383qaq0`. No provider/model/limit changes, database reset or seeding occurred.

## Public checks

- HTTPS health, customers and scoped payments APIs returned 200: 20 customers and 15 records for the selected account. A browser reload rendered the dashboard and the Northstar $84.99 payment-details panel.
- One read-only public Gemini investigation completed successfully: run `b7031395-e608-4377-b6df-7b6798d8ca3e`, four steps, 73,381 ms. It used `search_transactions`, `explain_decline_code` and `get_refund_policy`, then correctly explained the $129.00 Harbor Outfitters insufficient-funds decline and supported next steps.
- Independent production Neon verification confirmed succeeded status, unchanged 20 customers / 300 payments / two refund records / zero executions. No repair was required in this normal public flow.
- Configured estimated usage was 70,095 microUSD; retained production daily allocation rose from 384,835 to 454,930. These are conservative application accounting values, not provider invoices. Limits remained unchanged.

The separate [fault-injected recovery check](answer-recovery-verification.md) exercised the malformed-answer path on the persistent isolated Neon branch. It is not a natural model accuracy measurement. Original holdout and targeted failure results remain intact; intermittent provider availability and free-host cold starts remain limitations.

Raw rollout, public request and API evidence are retained in the chat workspace's `outputs/recovery-rollout-932d8c3.json`, `outputs/public-recovery-rollout-932d8c3.json` and `outputs/public-recovery-api-checks.json`.
