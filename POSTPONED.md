# Postponed

Everything deliberately deferred, plus the things that turned out to be deferred by
accident. Nothing here is a bug report you need to triage — it is the list you asked for
so the pile stops living in chat history.

Ordered by what stops a launch, not by when it came up. Last updated 2026-08-28.

Legend: **[BLOCKS LAUNCH]** · **[NEEDS A DECISION]** — I cannot pick for you, it changes
the schema or costs money · **[SMALL]** — do it any afternoon · **[BY DESIGN]** — noted so
nobody "fixes" it later.

---

## 1. Blocks launch

### 1.1 RLS is off on twelve tables · [BLOCKS LAUNCH — migration drafted, held]

`stores`, `products`, `product_variants`, `product_options`, `product_option_values`,
`product_variant_options`, `collections`, `product_collections`, `tags`, `product_tags`,
`product_size_measurements`, `store_theme_customizations` — row-level security disabled.
The browser's publishable key can read and write **every seller's** catalogue, not just
its own. `stores` already has 3 policies written; they do nothing while RLS is off.

Unblocked by 1.2 (done, below). A full migration is written — 6 `SECURITY DEFINER` helper
functions (`owns_store`, `owns_product`, `owns_option`, `owns_variant`, `owns_collection`,
`owns_tag`) plus one owner-scoped policy per table — and has been reviewed, but the user
has explicitly held it rather than applying it yet. Ask before running it; it isn't a
"just do it" item even though the code and copy are ready. Folds in 3.7 (below).

### 1.2 `DEV_STORE_ID` is hardcoded · [DONE — 2026-08-26]

Replaced everywhere (`store.products.tsx`, `store.products_.new.tsx`,
`store.collections_.new.tsx`, `CollectionsSheet.tsx`, `TagsSheet.tsx`, and the three
store-theme hooks) with `useOwnStores`/`useActiveStore`/`useActiveStoreId` in
`src/hooks/use-own-store.ts`, which resolve the signed-in seller's own store(s) from
`stores.owner_id = auth.uid()` — same tie-break order (`created_at`, then `id`) that
`requireOwnStore` already uses server-side, so client and server agree on which store is
"the" store for a single-store seller.

### 1.3 Two-store sellers have no store picker · [DONE — 2026-08-26]

`stores` still has no unique constraint on `owner_id` (unchanged, and not needed to fix
this), but `useActiveStore` now tracks which of the account's stores is active
(sessionStorage-backed, not localStorage — see 3.6) and `src/routes/store.tsx` shows a
switcher in the header whenever a seller owns more than one, silently staying a static
label otherwise. Every write path (`store.products_.new.tsx`, `store.collections_.new.tsx`,
the theme hooks) reads the same active id, so switching stores in the shell changes what
the "escaped" `_new` routes write into as well.

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

### 2.1 The universal size chart · [MOSTLY DONE]

Built and real, not local-only state: `src/lib/size-chart-config.ts` defines a per-category
chart (lettered measurement lines — shoulder/chest/body-length/sleeve/waist/etc. — matched to
a guide illustration), sellers fill in actual cm numbers per size via `SizeChartSheet`, and
those numbers persist to a real `product_size_measurements` table (not a schema question
anymore — this shipped 2026-08-31, referenced from both product-form save paths and the
account-deletion cleanup route). A loose plausibility check (real garment ratio bounds, widened
deliberately so no legitimate cut gets rejected) catches typo'd/garbled input without exposing
any rule text to sellers.

What's left is coverage, not architecture: 18 guide images are wired up (tops: t-shirt, polo,
dress shirt, off-shoulder, NFL/football jersey; bottoms: joggers x4, trousers, jeans, shorts x5),
but categories that require Size and have no chart yet — shoes, dresses, costumes &
accessories — fall back to the old manual-pick-only flow (`ManualSize`) with no measurement
chart. Add more by extending `CHARTS_BY_CATEGORY` + `GUIDE_IMAGES`, same pattern as the existing
entries.

### 2.2 `/find-your-fit` collects nothing · [DONE — 2026-08-28]

Height, weight, gender, body type, measurements and a full-body photo now persist to a real
table, plus a follow-up step (`/whats-your-style` — fashion/cosmetics/art style tags, with a
validated custom-entry option) for creators and curators. Both write to `fit_profiles`, one
row per person keyed by `owner_id` rather than one per role — `creators`/`curators` shrank to
pure role-membership markers (`id`/`owner_id`/`created_at`), so someone who's both creator
and curator answers these questions once, not twice; picking up the second role just records
membership and reuses the existing data. `resolvePostAuthRedirect` now resumes correctly into
either step, so the knock-on below is also fixed.

~~Knock-on: onboarding cannot **resume** into `/find-your-fit`. `resolvePostAuthRedirect` has
no way to tell whether a creator finished it, so a creator who abandons at that step is
treated as fully onboarded on their next sign-in.~~ Fixed alongside the above.

2.1 (the universal size chart, product-facing) is a separate, still-open decision — this item
was only ever about find-your-fit's own persistence, not the buyer-facing size chart.

### 2.3 Public profiles do not work · [DONE — 2026-08-26]

Fixed with a public **view**, `public_profiles` (migration
`20260826155813_add_public_profiles_view.sql`) — exposes only `id`, `personal_username`,
`display_name`, `avatar_url`, `bio`. Same deliberate `SECURITY DEFINER`-style RLS bypass as
`profile_stats`; `personal_email`, `personal_phone`, `gender`, `referral_source` stay behind
the row-scoped policy on `profiles` itself. `src/routes/profile.$username.tsx` now queries
the view instead of `profiles` directly, and `isOwnProfile` (previously hardcoded `true`)
is a real check against the signed-in session — verified in the browser signed-out,
against a real account (`/profile/diadem`), with no edit/menu affordances shown and no
console errors.

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

### 2.5 Stored-XSS fuse in the description editor · [DONE — 2026-08-26]

Fixed with the hand-rolled allow-list option (not DOMPurify, to avoid a `bunfig.toml`
exclusion) — `src/lib/sanitize-html.ts`. Allow-lists tags the editor's own toolbar can
actually produce (`b`/`i`/`u`/`p`/`div`/`br`/`ul`/`ol`/`li`/`a`/`span`), drops
`script`/`style`/`iframe`/`svg`/etc. entirely rather than unwrapping them, strips every
attribute except a scheme-checked `a[href]` (http/https/mailto only) and the exact
`text-align` inline style `justifyLeft`/`Center`/`Right` write. Called on both the load
path (`el.innerHTML = value`) and the save path, so an already-stashed unsanitized draft
gets cleaned too. Verified against `onclick`, `<img onerror>`, `<script>`, `javascript:`
hrefs, and disallowed inline styles in a real browser — all neutralized, safe content
passed through unchanged.

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

### 3.1 Live username availability · [DONE — 2026-08-26]

Added `is_username_available(check_username)` (migration
`20260826155757_add_is_username_available_rpc.sql`) — `SECURITY DEFINER`, returns only a
boolean so it can't leak whether an id exists, excludes the caller's own row via
`id IS DISTINCT FROM auth.uid()` so re-submitting your current username doesn't self-report
as taken. `/choose-username` calls it on a 400ms debounce and shows
Checking/Available/Taken inline; the upsert's unique-constraint error on submit is still
the authoritative check. Verified directly against the DB (`diadem` → false, an unused name
→ true).

### 3.2 Change-password UI in settings · [DONE — 2026-08-26]

`src/routes/settings.tsx` (previously a bare placeholder) now has a Password section that
adapts its copy for Google-only accounts ("Set a password") vs. accounts that already have
one ("Change password", which re-verifies the current password via `signInWithPassword`
before calling `setAccountPassword` — closes the "device left signed in" lockout risk that
a bare `updateUser` call would have left open). Reuses `checkPassword`/`MIN_PASSWORD_LENGTH`
and the strength-meter markup from `/create-password`.

### 3.3 A sign-up link on `/sign-in` · [DONE]

`/sign-in` now has a "Create a new account" link to `/no-account`, and `/no-account`'s
session-required guard was removed so it works for a signed-out visitor arriving that way,
not just post-auth.

### 3.4 `AuthPanel` header uses `/favicon.png` · [DONE — 2026-08-26]

Now shows `logo-o.png` + "akmonte" (matching the `/welcome` screen's lockup, not the
landing's larger one with the tagline — same portable Tailwind pattern, no landing-specific
CSS classes pulled in).

### 3.5 Fonts do not match the landing · [SMALL]

The landing uses **Archivo Black** for display and **Inter** for body. The onboarding
routes use **Cormorant Garamond** (`font-serif`) for headings. The last brief was colour
only, so nothing changed — but the two will read as different products side by side until
one of them moves. Explicitly left alone again on 2026-08-26 — deliberate, not forgotten.

### 3.6 Session tokens live in localStorage · [BY DESIGN, for now]

Standard for a Supabase SPA, and the reason 2.5 matters. Moving to httpOnly cookies means
an SSR cookie-auth rewrite across every route. Not worth it before launch; worth knowing.

### 3.7 `product_options`, `product_option_values`, `product_variant_options` · [FOLDED INTO 1.1]

As of 2026-08-26 these three are actually RLS **disabled** (matching `products`), not
"RLS on, 0 policies" as this used to say — check `mcp__supabase__get_advisors` rather than
trusting either version if it matters. Either way, the held 1.1 migration already covers
all three (`owns_product`/`owns_option`/`owns_variant` helpers), so there's nothing separate
left to do here.

---

## 4. Waiting on the landing page

### 4.1 `index.tsx` ← `OakmonteLanding.tsx` · [DONE]

The landing is now `index.tsx`, CTAs wired to `/set-up-store`, `/become-a-creator`,
`/become-a-curator`. `/no-account` is still live (see 3.3) — kept as the destination for a
signed-in user with no recorded intent, and as the exit from `/sign-in`'s "Create a new
account" link, rather than being deleted.

### 4.2 `privacy.tsx` and `terms.tsx` · [DONE — 2026-08-26]

Eyeballed. Both are in good shape: `brand-*` tokens applied correctly, and every genuinely
undecided legal/business detail (payment processor name, age policy, fee %, jurisdiction,
retention period, etc.) is already marked with a visible `Placeholder` component rather
than invented — that's the right pattern, not a gap to fill in here. One real bug fixed:
`terms.tsx`'s footer had a dead `<a href="#">` for Privacy instead of a real `Link`
(`privacy.tsx`'s footer already linked correctly both ways).

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

- **`profile_stats` and `public_profiles` show as Supabase advisor ERRORs** (`security_definer_view`).
  Both are deliberately plain views with no `security_invoker` option, exposing only an id
  plus non-sensitive columns (follower counts; username/display name/avatar/bio). False
  positives for this design — see 2.3.
- **Hard-refreshing `/create/after-shot/studio` drops a pending capture.** Known and
  accepted: the camera handoff is an in-memory module variable because the payload is a
  `Blob` and client-side navigation never reloads the page.
