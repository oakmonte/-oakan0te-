# Postponed

Everything deliberately deferred, plus the things that turned out to be deferred by
accident. Nothing here is a bug report you need to triage — it is the list you asked for
so the pile stops living in chat history.

Ordered by what stops a launch, not by when it came up. Last updated 2026-08-20.

Legend: **[BLOCKS LAUNCH]** · **[NEEDS A DECISION]** — I cannot pick for you, it changes
the schema or costs money · **[SMALL]** — do it any afternoon · **[BY DESIGN]** — noted so
nobody "fixes" it later.

---

## 1. Blocks launch

### 1.1 RLS is off on seven tables · [BLOCKS LAUNCH]

`collections`, `product_collections`, `product_tags`, `product_variants`, `products`,
`stores`, `tags` — row-level security disabled. The browser's publishable key can read
and write **every seller's** catalogue, not just its own. `stores` already has 3 policies
written; they do nothing while RLS is off.

Blocked on 1.2. Turning RLS on without real store scoping breaks every dashboard write at
once.

### 1.2 `DEV_STORE_ID` is hardcoded · [BLOCKS LAUNCH]

`src/routes/store.products.tsx:14` and `src/routes/store.products_.new.tsx:31`. The
dashboard reads one fixed store id instead of the signed-in seller's. Consequence today: a
store created during onboarding is orphaned — the seller makes one, then the dashboard
shows a different store's products.

This is the keystone. 1.1 and 1.3 both unblock the moment it lands.

### 1.3 Two-store sellers have no store picker · [BLOCKS LAUNCH]

`stores` has no unique constraint on `owner_id`, and one live account already owns two
(created by the Back-then-resubmit path in `/name-your-store`, now closed with
`replace: true`). `requireOwnStore` in `src/lib/server-auth.ts` deliberately picks the
**oldest** store; `src/routes/store.finance.tsx` has no selector. A two-store owner can
therefore bind payout details to the store they did not mean to. Fine while nobody is
being paid; not fine after Paystack.

### 1.4 Supabase dashboard settings there is no API for · [BLOCKS LAUNCH]

These have to be clicked by hand — Auth → Policies / Rate Limits:

- **Leaked password protection (HaveIBeenPwned)** — currently off, advisor-flagged.
- **Minimum length + required character classes.** Set them to match
  `MIN_PASSWORD_LENGTH = 10` in `src/lib/password-policy.ts`. Until then that policy is a
  client-side courtesy; anyone can POST straight to the auth endpoint and set `abc`.
- **Rate limits on the token / OTP endpoints.** Nothing currently slows down password or
  code guessing.

### 1.5 Payments are not connected · [BLOCKS LAUNCH]

Paystack is not wired. `store_payout_accounts.status` is always written as `"pending"`
because nothing verifies an account. The table currently holds 0 rows.

---

## 2. Needs a decision

### 2.1 The universal size chart · [NEEDS A DECISION]

The `cm` / `in` size systems emit plain strings — `"91 cm"` — not structured measurements.
Before any UI gets built, the schema question has to be answered: where do the per-value
cm/inch numbers live?

- on the option,
- on `product_variants`, or
- in a separate size-chart table keyed to the buyer's body measurements.

Do **not** bolt on local-only UI state — it has to persist. This is the largest piece of
deferred product work, and everything in 2.2 hangs off it.

### 2.2 `/find-your-fit` collects nothing · [NEEDS A DECISION]

`src/routes/find-your-fit.tsx:768`. Height, weight, gender, body type and measurements are
written to `sessionStorage` and read by nothing. There are no columns for them. The page is
a working, navigable shell — which is all the last brief asked for — and it stays that way
until 2.1 is settled.

Knock-on: onboarding cannot **resume** into `/find-your-fit`. `resolvePostAuthRedirect` has
no way to tell whether a creator finished it, so a creator who abandons at that step is
treated as fully onboarded on their next sign-in.

### 2.3 Public profiles do not work · [NEEDS A DECISION]

The `profiles` SELECT policy is `auth.uid() = id`, so `/profile/$username` can only ever
load **your own** profile. Anyone else's returns 0 rows (406) and the page silently falls
back to the URL username with zeroed counts.

The decision: `profiles` also holds `personal_email`, `personal_phone` and `gender`, and
RLS is row-level, so a naive public policy exposes those too. The shape that fits is a
public **view** over the safe columns, like the existing `profile_stats`.

### 2.4 OAuth `state` has no per-session nonce · [NEEDS A DECISION]

`src/routes/api.shopify.install.tsx` and `src/routes/api.instagram.connect.ts`. Anonymous
state-minting is closed (both are authenticated POSTs now), but `state` still cannot prove
the browser finishing the callback is the one that started it. An attacker **with their own
seller account** could phish a seller into authorising, landing the victim's Instagram or
Shopify token under the attacker's store.

Full fix = a single-use nonce persisted against `(user_id, store_id)` plus an httpOnly
cookie the callback checks — i.e. a migration in the import area that is postponed.
Nothing in the UI calls these routes yet, so it is not urgent, but it is the most serious
thing still open.

### 2.5 Stored-XSS fuse in the description editor · [NEEDS A DECISION]

`src/components/product-form/DescriptionSheet.tsx:96` does `el.innerHTML = value`, and
lines 137-138 save raw `innerHTML`. No sanitizer exists anywhere in the project.

**Not exploitable today** — nothing renders descriptions back as HTML. The day a product
page does, a seller can plant a script that steals any buyer's session (which lives in
localStorage, see 3.6). Two ways to fix it:

- **DOMPurify** — needs a `bunfig.toml` exclusion from the 24h `minimumReleaseAge` guard,
  which CLAUDE.md says to ask about first; or
- **a hand-rolled allow-list**, roughly 40 lines, no dependency.

### 2.6 Two-factor auth · [NEEDS A DECISION]

Supabase supports TOTP; 0 factors are enrolled and there is no enrolment UI or recovery
codes. Fair to defer, but it should be a launch gate for sellers holding bank details.

### 2.7 Apple sign-in · [NEEDS A DECISION]

Button removed entirely — it was dead. Costs $99/yr for an Apple developer account. Re-add
when that is worth paying for.

### 2.8 Where "How did you hear about us?" sits in the flow · [NEEDS A DECISION]

It currently interrupts the middle of all three flows. Attribution is usually better
collected after the user has something to lose, not before. Moving it is a one-line change
to `FLOWS` in `src/lib/onboarding-flow.ts` — it stayed put because moving it is a product
call, not a bug fix.

---

## 3. Small, unblocked

### 3.1 Live username availability · [SMALL]

`/choose-username` only discovers a collision when Continue is pressed, via the unique
constraint. A debounced RPC would say so as you type.

### 3.2 Change-password UI in settings · [SMALL]

`/create-password` is the only place a password can be set. The forgot-password route now
works (sign-in → "Forgot password? Email me a code" → code → `/create-password`), but a
signed-in user who simply wants to _change_ theirs has nowhere to go.
`src/routes/settings.tsx` is the home for it.

### 3.3 A sign-up link on `/sign-in` · [SMALL]

`/sign-in` is a dead end for someone without an account. It deliberately will not say the
address is unregistered — that would be an enumeration oracle — so it has to offer a way
out instead. Waiting on the new `index.tsx`, whose three CTAs are the sign-up path.

### 3.4 `AuthPanel` header uses `/favicon.png` · [SMALL]

`src/components/onboarding/AuthPanel.tsx` shows the favicon where the landing shows the
full lockup (`logo-o.png` + "akmonte" + "CREATED TO CREATE."). The `/welcome` screen uses
the real lockup. Cosmetic, and not a colour change, so it was left alone.

### 3.5 Fonts do not match the landing · [SMALL]

The landing uses **Archivo Black** for display and **Inter** for body. The onboarding
routes use **Cormorant Garamond** (`font-serif`) for headings. The last brief was colour
only, so nothing changed — but the two will read as different products side by side until
one of them moves.

### 3.6 Session tokens live in localStorage · [BY DESIGN, for now]

Standard for a Supabase SPA, and the reason 2.5 matters. Moving to httpOnly cookies means
an SSR cookie-auth rewrite across every route. Not worth it before launch; worth knowing.

### 3.7 `product_options`, `product_option_values`, `product_variant_options` · [SMALL]

RLS **on**, 0 policies — so the browser client reads _nothing_ from them, while the flat
`option1_*` columns on `product_variants` are wide open (1.1). Exactly backwards. Any
browser-side read of the normalized option tables silently returns empty. Fold this into
the 1.1 policy pass.

---

## 4. Waiting on the landing page

### 4.1 `index.tsx` ← `OakmonteLanding.tsx`

The landing gets pasted over `index.tsx` with the three CTAs wired to `/set-up-store`,
`/become-a-creator`, `/become-a-curator`. Two things must not survive that swap:

- **`getProfileUsernameFromUser`** (`src/lib/auth.ts`). It is a legacy client-side _guess_
  at a username from the email address. `index.tsx:39` still calls it for "View profile".
  Real navigation goes through `resolvePostAuthRedirect`; display names come from
  `getDisplayNameFromUser`.
- **`/no-account`** and the standalone sign-up button, both of which disappear with the new
  landing. `resolvePostAuthRedirect` can still return `/no-account` for a signed-in user
  with no recorded intent — once the landing lands, that branch needs to point somewhere
  real.

### 4.2 `privacy.tsx` and `terms.tsx`

Both use the `brand-*` tokens, so they picked up the new white/black/blue palette
automatically when the tokens flipped. Neither has been looked at since. Worth an eyeball.

---

## 5. Done — recorded so it stops coming back

- Onboarding welcome screen before the profile. `/welcome`, all three flows.
- `/phone-number`, `/product-category`, `/creator-niche` — deleted everywhere.
- "Magic link" wording — the templates send a 6-digit code, and the copy now says so.
- The curator infinite loop, and the creator/seller flows that ended in a TODO.
- A password after PIN verification, so repeat logins stop costing emails.
- Forgot-password now actually reaches `/create-password` instead of dead-ending.
- `/api/store/payout` was unauthenticated — it returned and overwrote any seller's bank
  details over plain HTTP with a guessable id. Fixed; 0 rows had ever been written, so
  nothing leaked.
- PKCE, security headers, ownership checks on every `api.*` route, password policy,
  account-enumeration oracles, the `rls_auto_enable` revoke.

### Not a bug — do not "fix" these

- **`profile_stats` shows as a Supabase advisor ERROR.** It is `SECURITY DEFINER` on
  purpose and exposes only an id and follower counts — no PII. A false positive for this
  design, and the same shape 2.3 should use.
- **Hard-refreshing `/create/after-shot/studio` drops a pending capture.** Known and
  accepted: the camera handoff is an in-memory module variable because the payload is a
  `Blob` and client-side navigation never reloads the page.
