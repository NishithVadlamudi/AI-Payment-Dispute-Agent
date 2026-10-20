# Payment workspace and home-screen installation

The approved rounded green dashboard is implemented at `/payments`. The landing page’s Try it links lead there. Overview, investigations, approvals, and activity share navigation and theme tokens.

## Structure and limits

- `src/components/payments/` separates the account summary, chart, ledger, detail dialog, investigation form, and request lifecycle. `WorkspaceShell` and `SiteHeader` provide shared desktop, tablet and mobile navigation.
- `GET /api/payments?customer_id=<uuid>` verifies an existing demo customer server-side, uses explicit column selections and validates the response with Zod. Card numbers are masked last-four records, never full account numbers. The existing indexed transaction query returns at most 50 records, with a visible partial-view label when more exist. Payment methods and transactions load concurrently after scope verification; refunds are restricted to those transactions.
- Totals and chart bins come from the loaded records. Amounts stay integer cents; formatting divides only for display. Each currency has its own view and totals. The dashboard does not claim a bank balance or manufacture growth percentages. The duplicate indicator requires successful charges with matching customer, merchant, amount and currency within five minutes; this remains a signal, not proof.
- The ledger renders four rows per page, supports merchant/reference search and status filters, and exports the loaded currency view to CSV with formula neutralization. A payment detail dialog shows the full reference, UTC creation time and refund history.
- Changing customers aborts earlier requests and clears selected payment context. Loading, empty, no-results and database-failure states are explicit; the UI never silently substitutes fixture data when its database fails.
- Dashboard questions are kept briefly in session storage as unsent drafts. The chat validates the selected demo customer and message length, consumes the draft, and waits for the user to send. Query text does not go into URLs. Scenario buttons select their actual planted customer. Existing agent limits, approval rules, audit behavior and idempotency remain in their server code paths.

For a real large-account product, the next step would be server-side cursor pagination and aggregate queries for account-wide metrics. This portfolio workspace deliberately caps requests and labels partial totals rather than fetching unbounded account history.

## Responsive and iOS behavior

The same Next.js application handles phones, tablets, landscape windows and desktops. Payment table rows become lists on narrow screens without discarding amount, status, method or UTC date. Navigation folds to a dialog and a fixed mobile bottom bar. Safe-area insets, dynamic viewport units, 44px controls, native dialog keyboard dismissal/focus restoration, zoom-friendly viewport settings, 16px mobile inputs and reduced-motion preferences support touch and keyboard use. Fonts are self-hosted; no external font connection is required.

`src/app/manifest.ts` defines standalone display, app identity, 192/512px icons, a maskable icon and shortcuts. The root layout includes Apple home-screen metadata and a 180px touch icon. Use an HTTPS deployment for installation:

- **iPhone/iPad:** open the deployed site in Safari, tap Share, then Add to Home Screen.
- **Android/desktop:** use the browser’s Install app action where available. Availability varies by browser.

This is an installable web application, not a native Swift app or an App Store submission. A network connection is required. No service worker caches payment records, approval responses or AI conversations. API responses use `Cache-Control: no-store`. There are no push-notification or background-payment claims.

## Verification

- TypeScript and optimized Next.js production build.
- 128 unit/API/UI tests, including dashboard scoping, unsent draft navigation, search, empty/error states, duplicate-signal rules, currency/cent formatting and CSV formula handling.
- 29 database integration tests, including the payment workspace loader and existing refund concurrency/security guarantees. Retained seed records, refund requests and traces were not reset.
- 70 Chromium layout checks: five routes in light/dark mode at 320×740, 390×844, 768×1024, 1024×768, 1440×1040, 1920×1080 and 844×390. No page-level horizontal overflow or JavaScript errors. Browser interaction checks cover search, pagination, native details, payment-to-draft handoff without an AI call, manifest/icon responses and mobile navigation.

Safari/WebKit was not verified: the execution environment blocked the Playwright browser download domains. Real iPhone/iPad installation, keyboard behavior and standalone safe areas still need a device smoke test on the HTTPS deployment. Responsive Chromium checks do not establish compatibility with every browser or device.


Reproduce the browser checks against the seeded local app (no AI request is sent):

```bash
python -m pip install playwright
python -m playwright install chromium
python scripts/check-responsive-ui.py
```

Pass `--chromium /path/to/chromium` to use a system browser, or `--base-url <your-test-app>` to test another instance. Evidence goes into the ignored `.ui-checks/` directory. Screenshots in the README use the production build. [Phone screenshot](../public/workspace-phone.png).

The optional [Render + Neon deployment](free-deployment.md) now provides a Supabase-hosting-independent runtime. Customer refund proposals link directly to their review card; attached payment context can be removed before preparing a question.
