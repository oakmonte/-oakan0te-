# Kickoff prompt for extra agents on the orders/checkout branch

Paste the block below into each new agent, then add that agent's JOB line at the end.
Open each agent in its OWN worktree (step 1 does it). Never two agents in one folder.

---

You are joining the Oakmonte orders/checkout build. Read `ORDERS-HANDOFF.md` and `CLAUDE.md`
first; they are the source of truth for what exists and what is decided.

SETUP (once, from the main Oakmonte checkout):
1. `git fetch origin`
2. `git worktree add "../oakmonte-<your-lane>" -b feature/orders-<your-lane> origin/feature/orders-checkout`
   (if that branch is not on GitHub yet, base it on the local `feature/orders-checkout`)
3. In the new folder: link node_modules (`cmd //c mklink //J node_modules "..\..\Oakmonte\node_modules"`)
   and run `git config core.hooksPath .githooks`.
4. Ask Diadem to copy the local env file into your folder. Do NOT read, print or copy env files
   yourself, and never paste a key into chat, code, commits or docs.

RULES, NO EXCEPTIONS:
- Work only in your own worktree and branch. Commit only files you changed. Bun, not npm.
- Never force-push, rebase, amend or squash anything already pushed. Never push to `main`.
- Never apply SQL, run a migration or change database policies. Write the migration file,
  tell Diadem, wait. The orders tables already exist on the live database.
- Never create orders, payments or payouts against the live database for testing without
  telling Diadem first, and clean up what you create (mark test orders cancelled).
- Stay in your lane (below). If you need a file another lane owns, leave a note in
  `ORDERS-HANDOFF.md` under "Requests" and move on.
- Money rules: amounts are integers in kobo; prices are always recomputed on the server; a
  webhook is trusted only after its signature checks out; settling a payment is idempotent.
- Before every commit: `bun run typecheck`, `bun run lint`, `bun test src`. Before asking Diadem
  to merge: `bun run build`. Format only what you changed: `bunx prettier --write <files>`.
- Merge `origin/feature/orders-checkout` into your branch often. Never leave conflict markers.
- Seller screens use the `--sd-*` tokens. Buyer screens are dark with `chat-*` tokens or the
  checkout's own dark styling. Mobile first, phone width.
- Be honest in reports: say what you ran, what passed, what you did not test.

LANES (one per agent, no overlap):
- paystack: `src/lib/paystack.server.ts`, `src/lib/orders.server.ts`, `src/routes/api.orders*`,
  `src/routes/api.paystack.*`. Split payments / subaccounts and the 6% platform fee, seller bank
  verification, refunds, seller decline.
- seller: `src/routes/store.orders.tsx`, `src/routes/api.store.orders*`, a new seller shipping
  settings screen. Shipping strategy (flat / by state / live), pickup address, default weight.
- buyer: `src/routes/checkout.*`, `src/routes/order.*`, cart (Add to Bag), Make Offer, order
  history, order emails.
- home: `src/routes/home.tsx`, `src/components/home/*`, the Explore and Shop feeds.

JOB:

---

Suggested JOB lines: one lane name each, e.g. "JOB: you are the paystack lane. Start with
subaccount + split payment for the 6% fee, test-mode only, and write unit tests."
