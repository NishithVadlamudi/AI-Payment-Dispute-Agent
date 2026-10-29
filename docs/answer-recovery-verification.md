# Bounded answer recovery — October 29, 2026

The prior six-case regression campaign remains **5/6**, with one unusable final answer. This change does not rewrite that result or establish new holdout accuracy. Its recorded tool lookups succeeded, but a normally completed final turn returned only `₀`. The evidence does not identify an internal provider cause.

## Product fix

After successful tool evidence and a normally completed final answer containing no Unicode letters, the loop now permits one answer-recovery turn within the existing eight-turn ceiling. It uses the same Gemini provider/model, budget reservations, token allowance and timeout. Recovery disables all tools at the provider and loop boundaries; an unexpected tool call is rejected before execution and recovery text is buffered until that check passes. The correction instructs the model to summarize existing evidence without inventing facts or taking actions. The audit records `answer_repair_started` without storing the rejected raw answer.

Provider exceptions, incomplete streams, quota errors and network failures do not trigger this recovery. A second unusable answer fails explicitly. This narrow shape check cannot detect every incorrect or low-quality answer. Provider availability remains an external limitation.

## Verification

- 160 tests pass, including recovery success, rejected tool calls, failed recovery, the eight-turn ceiling, provider exceptions and Gemini's tools-disabled configuration. Type checking and the production Webpack build pass.
- A frozen fault-injection check used the persistent isolated Neon branch `br-summer-bonus-b5us8mp6`, verified TLS and the private PostgREST adapter. Two scripted read-only tool calls retrieved the actual seeded transaction and decline reference. The harness injected the malformed answer, then made exactly **one real Gemini call** for recovery. Scripted turns were not represented as billed model calls.
- Run `d93b4e9a-2af2-453d-bc88-1ed51d49f2e9` completed successfully. Gemini returned the correct $129.00 Harbor Outfitters decline explanation, with insufficient funds and a supported next step. It made no additional tool calls. Refund records were unchanged; independent Neon verification found zero refund executions and exactly one repair audit event.
- The literal reason regex in the raw check returned false because the answer says “available funds were insufficient” and uses `insufficient_funds`, rather than the contiguous phrase “insufficient funds.” Manual semantic review passes; the raw false result is preserved. No scorer was changed and no call was repeated.
- The live recovery step took 14,784 ms and reported 1,206 input / 125 output tokens: 8,530 microUSD under the unchanged conservative accounting rates. Its 130,130 microUSD reservation settled normally. The isolated daily retained allocation increased from 333,520 to 342,050 against the unchanged 5,000,000 cap. These are application estimates, not a provider invoice. Run-level usage remains unknown because the two synthetic turns have no provider usage.

The pre-call protocol and source hashes are in the chat workspace's `outputs/recovery-freeze-manifest.json`; raw answer/checks and independent SQL evidence are in `outputs/recovery-fault-probe.json` and `outputs/recovery-neon-verification.json`. This demonstrates the recovery mechanism under deliberate fault injection, **not a natural model pass rate**. Historical evaluation reports remain unchanged. The user approved committing, pushing and deploying this fix after reviewing these results. Public rollout verification is recorded separately; final media publication stays paused.
