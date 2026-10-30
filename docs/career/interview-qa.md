# Interview questions and answers

1. **What does the system do?**
Resolve investigates fictional payment disputes for a selected demo customer. Gemini can read payment evidence, explain decline codes and propose an eligible refund. A person retains refund approval, and no real payment processor is connected.

2. **How is it structured?**
Next.js serves the dashboard, API routes and streaming chat. Code renders final explanations from validated tool evidence while Gemini selects tools. Typed tools call a customer-scoped store through a private PostgREST adapter into Neon Postgres. Traces, budgets and the mock refund ledger persist in the database.

3. **Why use an agent?**
Questions can require several different evidence lookups rather than one fixed query. Native tool calls let the model choose among five constrained operations. Database rules enforce scope and refund eligibility even if its plan is wrong.

4. **Is this retrieval-augmented generation?**
It retrieves structured payment records and reference data through tools. There is no vector index or embedding-based document search in this project. Its important retrieval checks are customer scope, exact transaction evidence and actual decline-code lookup.

5. **How do you prevent duplicate refunds?**
Amounts use integer cents, and SQL rechecks eligibility against prior refunds and reservations. Locks serialize competing decisions and a unique execution key prevents duplicate mock execution. Isolated concurrent approval verification observed one execution from two requests.

6. **Can the model approve a refund?**
It has no approval or execution tool. request_refund creates a pending_approval record for review. Only the reviewer workflow can authorize the database execution path.

7. **How are prompts defended against injection?**
The server binds the selected customer and treats database text as untrusted evidence. A deterministic guard catches some explicit override attempts, while schemas, scoped queries and SQL rules constrain actual actions. The guard is deliberately not presented as complete injection protection.

8. **How did you evaluate it?**
The development dataset contains 40 cases, completed across compatible preserved reports. A frozen 16-case synthetic holdout completed automated checks, but manual review found errors the rubric missed. Later measurements remain separate. The fresh evidence-boundary protocol completed 22 model outcomes and two guards; manual review passed 21/22 model cases, and the remaining clarity defect was fixed and verified separately.

9. **Why not claim perfect accuracy?**
An automated pass only establishes the implemented rubric. The holdout missed misleading approval-state explanations, and a later model answer contained only one unusable character. The datasets are small, synthetic and share the fixture domain, so they do not establish real-world financial reliability.

10. **How do you separate infrastructure from model failure?**
Reports keep skipped cases, provider errors and completed scoring outcomes separate. Only missing or infrastructure-blocked cases may continue with all compatible prior reports. A completed scoring failure is retained and excluded from retry-until-pass selection.

11. **How do spending controls work?**
The database reserves a conservative allowance before each model turn. It settles unused reservation amounts only after normal completion and validated usage; uncertain failures retain their allocation. These values are application estimates rather than a provider invoice or a provider-enforced billing ceiling.

12. **What caused the budget bug?**
Completed successful calls initially retained their full worst-case reservations. This exhausted the app allowance despite lower validated usage. Audited settlement corrected accounting without increasing the cap or creating replacement branches to bypass it.

13. **How did you investigate public failures?**
The public error path indicated upstream HTTP 5xx, but discarded the exact status. I added allowlisted operational diagnostics that omit raw messages, URLs, prompts and secrets. A later public request succeeded, which proves recovery but does not reveal the exact historical 5xx cause.

14. **What tests run without keys?**
The current key-free suite has 194 unit, API and UI checks. CI also checks types, validates datasets and builds the application and deployment bundle. A separate isolated live Neon suite has 35 integration checks; local Postgres success is never described as Neon verification.

15. **What would you change before real production?**
The current public reviewer is fictional and not authenticated staff access. Real refunds would need real identity/access control, processor idempotency, durable delivery and reconciliation beyond the database-only mock guarantee. I would also expand independent evaluation, test provider recovery and measure latency under realistic load.
