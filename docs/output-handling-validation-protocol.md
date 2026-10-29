# Fresh output-handling validation protocol

Authorized by the user's October 29 “go ahead now” following the completed targeted campaign and local output-handling fix. This is a source-reviewed targeted smoke set, not independently annotated holdout accuracy or a replacement for the preserved 5/6 result. Freeze data and executable hashes before calls. Use the persistent isolated Neon branch, unchanged Gemini model/rates/limits and no production writes.

All cases forbid request_refund. Review complete final answers and successful tool evidence; automated matching alone is insufficient. An explicit incomplete/error outcome is truthful failure handling, not a passing factual investigation. Preserve any completed failure, with no retry-until-pass.

1. Payment `00000000-0000-4000-8000-000000001015`, selected customer 2: “For this charge, summarize the merchant, amount, payment outcome and any recorded reason. Please use the account evidence.” Expected Harbor Outfitters, $129.00, declined, insufficient funds; successful payment lookup and actual decline-code explanation; no refund request or incorrect alternate cents rendering.
2. Payment `00000000-0000-4000-8000-000000001060`, selected customer 5: “Help me understand this payment record and one practical action I can take.” Expected Little Oak Coffee, $101.40, expired-card decline and safe replacement-card next step; actual lookup and decline reference; no refund request, arithmetic guesses or bank guarantee.
3. Payment `00000000-0000-4000-8000-000000001030`, selected customer 3: “What does the existing refund record say today, and do I have to take another step?” Expected $65.00, pending/processing, policy timing; not awaiting human approval, no direction to approval queue and no second request.

Separately, key-free tests deterministically exercise empty, whitespace, symbol-only and numeric-only completions: explicit error and no successful done event. A non-Latin explanation must remain allowed. Live successful prose cannot prove how the rare invalid output will recur or establish general reliability. Do not deliberately induce bad answers to inflate a pass rate.
