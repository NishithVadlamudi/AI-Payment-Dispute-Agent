# Evidence-based final answers — local verification

The user approved changing the final-answer boundary on October 29, 2026 after reviewing the proposal. The implementation is local, uncommitted and undeployed.

## Implemented boundary

Gemini still selects the existing scoped tools. Final customer explanations are rendered from independently schema-validated tool records, not model text. The renderer checks the selected customer, requested/returned IDs, refund relationships and currency, reserved balances, conflicts and reference/policy identity. It uses fixed refund-state wording and local decline-reference wording. Untrusted merchant/display fields are quoted as inert inline data; refund reasons and policy descriptions are not used as instructions or arbitrary summary prose.

Only actual `pending_approval` records receive an approval link. Processing, completed, rejected and failed refunds remain distinct. The summary reports a per-payment unrefunded/unreserved balance only when full refund history was retrieved. Missing, contradictory or partial evidence is explicitly incomplete. Scope misses do not establish that a payment exists in another account. No renderer path creates a request or approves a refund.

The old free-text repair path is removed: arbitrary prose is no longer useful final-answer evidence, and no additional model call is made to rewrite it. The provider/model, eight-turn limit, token/rate/budget settings and SQL authority are unchanged. Native context remains server-side for tool planning; observable tool activity remains available. More constrained final explanations are the approved trade-off. A deterministic evidence summary does not establish that every possible natural-language user request was fulfilled.

## Checks

- **187 key-free tests pass**, including seven hostile/empty/malformed model-final variants, provider interruption, native context, five refund states, scopes, relationships, conflicts, currency/reserved-balance checks, missing policies and references, idempotent record replay and unsafe Markdown/HTML display.
- Type checking and production Webpack build pass.
- **35 database integration tests pass against the persistent isolated Neon branch**, using verified TLS and private PostgREST. The new check renders actual processing/completed refund records and rejects those records under a different selected customer. Concurrent/double approval still produces one mock execution.
- Offline replay of the retained failed qualification trace now renders the verified $107.90 pending payment and no-refund explanation, with no planning-style text released. This is regression replay, not a fresh model pass or a replacement qualification score. Original replay/failure evidence is preserved separately.
- Independent isolated Neon post-check: 20 customers, 300 demo payments, zero evaluation fixtures and zero refund executions. Retained allocation stays **1,878,025 microUSD**, unchanged from the quota-stopped run. No model call, production reset, reseed or limit increase was used.

The original loop tests for generative repair were replaced with tests for the approved evidence-only behavior; native tool plumbing, audit failure, cancellation, bounded turns and authority checks remain covered. The earlier test source is retained in the chat workspace for audit. One native-provider test now correctly expects incomplete evidence from reference-only calls instead of treating a payment-free model answer as successful.

## Historical evidence and next gate

The earlier 18/22 release result and partial 8/9 reviewed qualification sample remain unchanged. The exposed qualification set is retired for improvement claims after this design change; do not continue its remaining cases on a different runtime and merge scores. All 36 frozen source/protocol byte streams have been archived and matched to pre-inference SHA-256 hashes in the chat workspace's `outputs/qualification-frozen-source.zip` (archive reconstructed and verified after the run).

New model-backed current-runtime claims require fresh reviewed/frozen validation after quota permits. The exact provider quota/reset was not established; application UTC allowance does not guarantee provider recovery. No further model call is authorized during the current stopped allowance period. Final media stays unpublished until implementation/deployment and fresh validation are complete.

Evidence: chat workspace `outputs/output-boundary-diagnostic.json` (before), `outputs/output-boundary-diagnostic-after.json` (after), `outputs/evidence-boundary-neon-verification.json`, and the immutable qualification reports. The source renderer, loop and test files document the executable contract.

## Discovery-selection correction after cooldown retry

A user-authorized read-only retry (`ef392539-e181-443e-90da-bf4543522b75`) completed three Gemini turns without a provider error, but broad search returned 15 candidates and the planner stopped after the decline reference without fetching the target's detail/refund history. The renderer correctly refused completeness but displayed unrelated candidates. This is an application completion defect, not a quota error or passing investigation.

Search candidates remain fully scope/conflict validated. Once detail records are retrieved, final summaries select those records plus any payment with a returned refund record, preserving action visibility. Explicitly retrieved comparison payments remain visible; unrelated discovery candidates no longer make a targeted summary incomplete. Search-only summaries remain incomplete. The planner receives one bounded discovery-to-detail continuation if it stops with search evidence and no detail read; this stays inside the eight-turn maximum and existing budget controls, does not retry provider failures, and cannot itself execute a refund. Prompt guidance requires relevant detail reads even for declines. Missing or ambiguous evidence remains incomplete. This correction has not been deployed or measured as fresh model accuracy.

### Live correction verification

User authorized proceeding. Read-only isolated Neon/Gemini run `e7584c1a-5216-4b9f-80c4-d1961bf5a080` succeeded after four successful provider turns with search_transactions, get_transaction and explain_decline_code. Actual final answer contains only the Harbor Outfitters $129.00 declined payment, the recorded insufficient-funds reason and supported bank/payment-method guidance; no unrelated search candidates or incomplete warning. No refund-request tool ran. This is a known-case regression smoke check, not a fresh accuracy measurement or replacement of the earlier failed result. 191 key-free tests, type checking and production build pass. Provider/model/limits remain unchanged. Commit/deployment and fresh qualification remain outstanding.
