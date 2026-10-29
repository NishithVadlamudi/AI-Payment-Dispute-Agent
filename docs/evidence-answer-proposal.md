# Evidence-based final-answer boundary — approved

The user approved this design on October 29, 2026. It is implemented locally; see [verification](evidence-answer-verification.md).

## Problem

The qualification run showed that ordinary model answer text can contain planning-style narration despite provider thought filtering and local format checks. Prompt instructions and a prefix blocklist do not give a dependable presentation boundary.

## Proposed implementation

Keep Gemini for deciding which existing scoped tools to call. Preserve the current provider/model, eight-turn ceiling, token/rate/budget settings, human approval and SQL idempotency. Introduce no dependencies or new payment authority.

At the final-answer boundary, render customer-facing content from validated tool evidence instead of displaying arbitrary model prose:

- Payment summaries use scoped merchant, integer-cent amount, payment status and IDs. Quote/escape untrusted display fields.
- Declines use the actual recorded code and reference explanation/next step. Unknown references remain unknown.
- Refund summaries use explicit labels for `pending_approval`, `pending`, `succeeded`, `rejected` and `failed`. Approval links appear only for `pending_approval`. Policy timing appears only when actual policy evidence supports it.
- Successful request summaries use the returned refund ID, amount and actual state; they never claim execution or approval by the model.
- Scoped misses state only that no match was found in the selected account. Partial, conflicting or insufficient evidence yields an explicit incomplete result, rather than an invented narrative.
- Matching charges remain a signal, not proof. No refund is created by rendering; existing tools and human workflow retain all actions.

Structured tool events remain visible as investigation progress. The trade-off is less conversational flexibility in final explanations. Rendering must preserve meaningful distinctions between selected payments, search results, existing refunds and newly requested refunds; it must not manufacture fulfillment of an unanswered user question.

## Verification before recording

Add key-free adversarial-output tests demonstrating that arbitrary model planning text never becomes final customer copy; verify all five refund states, unknown declines, scope misses, conflicting/missing evidence and untrusted display fields. Retain the original failed trace unchanged. Re-run appropriate unit/type/build and isolated Neon checks. Use a new reviewed/frozen qualification protocol for live claims once quota permits; never rerun the completed failure until it passes.

The design approval covered local implementation. Commit/push/deploy still require explicit approval under the user's working rules. No media should be published until implementation, deployment and fresh verification are complete.
