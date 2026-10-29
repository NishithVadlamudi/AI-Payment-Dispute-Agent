# Completion gates before final recording

The public demo is live, but the project must not be described as fully evaluated. Final media recording is paused at the user's request until the end product and its evidence are complete.

## Evaluation

Latest evidence: [development evaluation completed](development-evaluation-complete.md). All 40 development cases now have completed passing automated outcomes (32 model-backed, eight guards), across four audited batches. Successful-reservation recovery and the settlement fix enabled completion without waiting for reset or raising the cap. Persistent evaluation branch: `br-summer-bonus-b5us8mp6`; preserve it. The user approved the frozen rubric and the holdout completed: 16/16 automated passes (14 model-backed, two guards), zero infrastructure errors. Actual-answer review found two misleading refund-status explanations and two money-presentation issues; see [holdout results](holdout-results.md). Do not reuse this holdout to claim improvement after tuning.

- [x] Preserve the original partial report and the version-2 partial baseline.
- [x] Add safe continuation selection: `--remaining-from <report.json>[,<report.json>...]` excludes completed passes **and completed scoring failures**, retrying only missing/infrastructure cases. Every batch gets a separate immutable report ID; do not overwrite original reports or claim a batch is the full suite.
- [x] Complete all 40 development cases across available allowance periods with the same prompt/model/scorer/fixture source. Track all report IDs and hashes. A completed failure remains a measured failure; do not rerun until passing.
- [ ] Root-cause any substantive development failures, make one justified change at a time, and rerun appropriate checks. Never tune on holdout outputs.
- [x] Review labels in `docs/holdout-label-review.md` and `evals/holdout.json`, then freeze dataset and implementation hashes. Do not claim independent human label review until it actually occurs.
- [x] Run all 16 holdout cases on the frozen implementation across available allowance periods; preserve failures and infrastructure coverage. A holdout need not be 100% to be complete, but every case must receive a valid outcome or a documented genuine unresolved blocker.
- [x] Produce an auditable combined development-case ledger across compatible batches, retaining attempted failures/estimated costs separately from final coverage. The holdout report contains all 16 outcomes in one batch; qualitative findings are documented separately. Do not cherry-pick the best attempt, average percentages from different denominators, or compare incompatible scorer versions as a model gain.

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

## Post-holdout quality gate

- [x] Clarify processing-versus-human-approval guidance and require one currency rendering; add four UI regression cases. All 141 key-free tests and type checking pass. This does not establish live model compliance.
- [x] User reviewed/froze six fresh targeted checks; three refund-status cases passed automated and manual review. See `post-holdout-validation-results.md`.
- [x] Resume only unfinished targeted cases: continuation `b968bbeb-4a66-4c7c-9876-371e39429dc9` completed the three remaining cases on October 29 UTC, with two passes and one genuine failed answer. Combined targeted results: five passes, one failure. Previous infrastructure attempts remain preserved. No completed result may be retried to improve the score.
- [x] Handle empty, symbol-only and numeric-only final output as an explicit incomplete-investigation error without successful completion or automatic retry. Five regression cases added; 146 key-free tests and type checking pass. This narrow Unicode-letter check does not validate semantic correctness. Preserve the genuine failed answer.
- [x] Fresh three-case smoke validation: report `7b676db5-759a-4c32-8bc8-fb7c1472ecef`, three automated/manual passes, no infrastructure errors or retries. Preserve the earlier 5/6 result. See `output-handling-validation-results.md`.
- [ ] Obtain explicit commit/push approval, then verify CI, Render rollout and public read-only chat. No final recording before rollout/product evidence is complete.
