# Provider failure investigation — October 29, 2026

Public runs `f9e1ad78-617a-4e8e-b47f-803864be0571` and `159ecc47-0834-4987-a744-d5db53f2f8d6` failed with the application's “temporarily unavailable” message. Source inspection establishes that `providerFailure` selects this text for numeric upstream HTTP status >=500. A 429 quota response, access rejection, local budget block, ordinary network exception and timeout have different paths. The exact 5xx status and upstream cause were not retained in the original sanitized traces; do not retroactively assert 503, overload, quota exhaustion or a guaranteed reset time.

Read-only `models.get` succeeded for the existing local key and `models/gemini-3.5-flash-lite`; this proves model discovery, not project billing/tier eligibility for inference. Google's troubleshooting documentation explicitly distinguishes metadata from inference access: https://ai.google.dev/gemini-api/docs/troubleshooting . No key, connection string or raw response was printed.

A single user-authorized diagnostic investigation then ran locally against existing isolated Neon branch `br-summer-bonus-b5us8mp6`, using normal reservation/settlement controls, the same Gemini model and unchanged rates/limits. Run `ecd27f7e-be9e-4dcc-a1f2-3dfc1663a3dc` succeeded: successful search_transactions and explain_decline_code, correct $129.00 insufficient-funds explanation, no request_refund call. Configured estimated cost: 68,535 microUSD. It is a debugging probe, not a new evaluation score or public verification. The scratch TypeScript harness initially failed compilation before any model call; switching its module extension to .mts corrected that startup-only problem.

This rules out a persistent inability of the local configuration to perform inference at that moment. It does not prove which Render/upstream component caused the two historical 5xx responses; intermittent service failure and deployment-specific routing/configuration remain possible.

## Prepared diagnostic fix

The Gemini adapter now emits one structured server warning per failure containing only an allowlisted HTTP status/category or recognized network/TLS code. It never logs exception messages, URLs, headers, keys, prompts or raw response bodies. Wrapped causes are inspected with a four-level bound. Tests cover 500/503, quota, access, request, wrapped exceptions, TLS codes, circular causes and secret-bearing payload exclusion. All **154 key-free tests**, type checking and the production Webpack build pass.

The patch is local and awaiting explicit commit/push/deploy approval. After deployment, one bounded public request can correlate the existing trace with sanitized server logs. Leave the model, prompt, limits and retries unchanged while diagnosing. A new failure must be preserved, not retried until success. Historical outcomes remain unchanged.
