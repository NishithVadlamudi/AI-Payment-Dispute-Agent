# One-minute pitch

A customer reports two charges for one purchase. Before anyone refunds money, someone needs to check the evidence.

I built Resolve, a payment-dispute demo using Next.js, TypeScript, Gemini tool calls and Neon Postgres. The agent searches the selected customer's transactions, explains recorded decline codes and proposes eligible refunds. It cannot approve one.

The boundary is enforced in code and SQL: integer cents, scoped reads, row locks and unique execution keys protect the mock ledger. A private PostgREST adapter keeps database access on the server.

I verified 194 key-free tests, 35 isolated Neon integration checks and a successful public Gemini investigation. Evaluation was deliberately less tidy: automated holdout passes missed answer-quality errors, and a later targeted case failed. I preserved those results instead of retrying them into a perfect score.

The lesson is that an observable workflow and honest failure handling matter as much as a convincing demo. All records are fictional.

## Two sentences
Resolve is a deployed payment-dispute demo where Gemini investigates fictional transactions and humans retain refund approval. I built the typed tools, Neon-backed safety controls and evaluation workflow, preserving failed results rather than claiming unmeasured accuracy.
