# Completion gates before final recording

The public demo is live, but the project must not be described as fully evaluated. Final media recording is paused at the user's request until the end product and its evidence are complete.

## Evaluation

Latest continuation: [October 28 evidence](evaluation-continuation-20261028.md). Compatible batches now complete 30/40 development cases (22 model-backed and eight guard passes), with ten unfinished. Persistent evaluation branch: `br-summer-bonus-b5us8mp6`; preserve it. Next eligible allowance period begins October 28 at 8 PM America/New_York. The holdout remains unrun.

- [x] Preserve the original partial report and the version-2 partial baseline.
- [x] Add safe continuation selection: `--remaining-from <report.json>[,<report.json>...]` excludes completed passes **and completed scoring failures**, retrying only missing/infrastructure cases. Every batch gets a separate immutable report ID; do not overwrite original reports or claim a batch is the full suite.
- [ ] Complete all 40 development cases across available allowance periods with the same prompt/model/scorer/fixtures. Track all report IDs and hashes. A completed failure remains a measured failure; do not rerun until passing.
- [ ] Root-cause any substantive development failures, make one justified change at a time, and rerun appropriate checks. Never tune on holdout outputs.
- [ ] Review labels in `docs/holdout-label-review.md` and `evals/holdout.json`, then freeze dataset and implementation hashes. Do not claim independent human label review until it actually occurs.
- [ ] Run all 16 holdout cases on the frozen implementation across available allowance periods; preserve failures and infrastructure coverage. A holdout need not be 100% to be complete, but every case must receive a valid outcome or a documented genuine unresolved blocker.
- [ ] Produce an auditable combined case ledger across compatible batches, retaining attempted failures/estimated costs separately from final coverage. Do not cherry-pick the best attempt, average percentages from different denominators, or compare incompatible scorer versions as a model gain.

## Allowance and isolation

On 2026-10-27, production allocated 437,555 microUSD and the isolated baseline allocated 4,463,770, for 4,901,325 of the unchanged 5,000,000 daily allowance. The next turn was blocked. Deleting the baseline branch does not erase that accounting history. No further model calls should be made during that UTC day; a new branch must not be used as a fresh allowance. The next reset is 2026-10-28 00:00 UTC (October 27, 8 PM America/New_York).

Use one persistent isolated evaluation branch after reset and retain its allowance state across batches. Keep production limits unchanged. Account for all relevant same-day evaluation/demo allocations before calls; branch isolation must not multiply the authorized daily allowance. Do not delete evaluation evidence until reports are preserved and branch cleanup is explicitly approved. Provider quota may block work independently of the application allowance.

## Product and ship

- [x] Public Render Free + existing Neon deployment verified; no real payment processor.
- [x] Prior 29 isolated Neon database tests and actual duplicate-approval verification.
- [x] Prior 131-test CI pass and six requested responsive/theme checks.
- [x] New continuation tests: 133 key-free tests pass; type checking and both dataset validations pass.
- [ ] Validate continuation changes on final CI after approved commit/push; local changes are not automatically deployed.
- [ ] Verify a normal public chat investigation within available allowance, with the selected customer, relevant evidence and truthful error handling. Do not create a production refund merely for the recording.
- [ ] Keep current known limitations visible: public fictional reviewer access, partial account totals, shared proxy bucket, free-host cold starts and development-tool advisories.
- [ ] Update README/result tables and user-facing evaluation material from final measurements. No invented holdout before/after baseline; if none exists, say so.

## Media and career handoff

- [x] Walkthrough script, launch storyboard and approved isolated Whisper setup.
- [ ] Obtain the user's ElevenLabs MP3 after the final results wording is settled.
- [ ] Capture actual read-only usage using headless Chrome/CDP; generate and inspect current `docs/demo.gif` and `docs/screenshot.jpg`.
- [ ] Produce narrated walkthrough with real word timestamps, final transcription, audio-gap check and scene-still review.
- [ ] Produce 20-second launch composition, original soundtrack, poster and share copy; inspect settled and transition frames.
- [ ] Deliver all six `docs/career/` files with only measured claims; leave portfolio repo and résumé PDF untouched.
- [ ] Obtain explicit approval for new installs, commits/pushes or destructive cleanup as required. No final recording before evaluation/product evidence is ready.

## Scheduled continuation

The user authorized a daily 8:05 PM America/New_York continuation in this chat. Automation ID: `finish-payment-agent-evaluation`. It must obey the same limits and approval requirements, stay quiet for unchanged blockers, and pause once the evaluation and recording handoff are complete.
