# Postponed

What's deliberately deferred, plus what turned out to be deferred by accident. Not a bug
tracker — a punchlist for what stops a launch. Shipped work isn't listed here; it's in git
history. Only kept here when there's still an open action, or a decision someone could
otherwise "fix" back into a mistake.

Legend: **[BLOCKS LAUNCH]** · **[NEEDS A DECISION]** — schema or money, not mine to pick ·
**[SMALL]** — an afternoon · **[BY DESIGN]** — don't "fix" this later.

---

## 1. Blocks launch

### 1.1 RLS on the store/catalogue tables · applied 2026-10-09

`supabase/migrations/20261009120000_store_catalogue_rls.sql`, run by Diadem in the SQL editor
(so it is not in `supabase_migrations` — don't re-run it from the CLI expecting a no-op without
checking; the `create policy` statements aren't idempotent). The earlier drafted migration was
never committed and is lost; this one was written fresh against the 2026-10-09 schema.

- Reads stay public on everything the storefront shows; `store_locations` is owner-only.
- Writes are owner-only through `owns_store/product/variant/option/collection/tag/location`
  (SECURITY DEFINER, empty search_path). Server routes and the import worker use the service
  role and are unaffected.
- `stores` is public row-wise, but SELECT is granted only on its public columns. The private
  ones (`business_email`, `business_phone`, `pickup_*`, `shopify_*`, `bumpa_store_id`) are
  server-only: the browser may write `business_email` but must never select it, and a
  `select("*")` on `stores` from the browser now fails.
- Anonymous accounts can't insert a store.

Still open: the advisor's `security_definer_view` errors on `public_profiles`/`profile_stats`
(by design, they're the public-column views) and the `is_email_registered` /
`is_username_available` RPCs callable signed-out (needed by sign-up).

### 1.2 Supabase dashboard settings with no API

Have to be clicked by hand — Auth → Policies / Rate Limits:

- Leaked password protection (HaveIBeenPwned) — currently off.
- Minimum length + character classes, matching `MIN_PASSWORD_LENGTH` in `password-policy.ts`.
  Until set, that policy is a client-side courtesy only — anyone can POST straight to the
  auth endpoint with `abc`.
- Rate limits on the token/OTP endpoints — nothing currently slows down guessing.

### 1.3 Payments are not connected

Paystack isn't wired. `store_payout_accounts.status` is always written `"pending"` because
nothing verifies an account.

### 1.4 Direct messages · applied, follow-ups open

`/messages` is built against the direct-messages migrations (conversations, messages, reactions,
blocks, reports, private `chat-media` bucket — RLS on every table from the start), **applied**
(`add_direct_messages` / `harden_direct_messages` are in the database's migration history).
Still to do: regenerate `my-supabase/types.ts` and delete the hand-written rows in
`src/lib/chat/db.ts`. Typing indicators ride public broadcast channels keyed by user id — fine
for launch, move to private Realtime channels later.

Read receipts: `20260929120000_read_receipts_setting.sql` was **applied 2026-10-02 by pasting
it into the Supabase SQL editor**, so it is not in the migration history table — a later
`supabase db push` may try to re-run it and fail on "already exists"; mark it applied
(`supabase migration repair`) first. Verified afterwards: 3 new tables, 11 backfilled rows each
(= `conversation_members`), the old cross-member SELECT policy gone, 4 triggers, both tables in
realtime. Still to do: regenerate types, then check on two accounts that ticks and "online" still
update live (they now ride `conversation_read_receipts` / `conversation_presence`) and that with
receipts off neither side turns blue. Contract later: drop
`conversation_members.last_delivered_at` / `last_active_at` once no deployed client predates the
migration.

### 1.5 Encrypted secrets · code done, rollout pending

Message bodies (DMs and support), Shopify/Bumpa/Instagram tokens and payout account numbers are
encrypted by the app before they're written (`src/lib/field-encryption.server.ts`, AES-256-GCM).
It isn't end-to-end: the server holds the key. Bodies now travel only through `api.chat.*` and
`api.support-messages.*`, which query **as the caller**, so RLS is still the authorization
boundary. Rollout, in this order:

1. `openssl rand -base64 32` → `DATA_ENCRYPTION_KEY` in Vercel (Production + Preview) and locally.
   Keep a copy somewhere safe: **lose the key and every encrypted value is gone for good.**
2. Apply `20260930120000_relax_encrypted_column_lengths.sql`. It only lifts the plaintext
   length checks, so it's safe with the old code too; skip it and long messages fail once
   bodies are ciphertext.
3. Deploy. Reads handle both plaintext and ciphertext; writes refuse to run without the key.
4. `bun scripts/encrypt-existing-secrets.ts` (dry run), then `--write`.
5. Apply `20260930130000_require_encrypted_columns.sql`, which refuses plaintext from then on.
   It fails if any plaintext is left; if so, re-run step 4 and apply it again.

Staff now see ciphertext in the dashboard, so support threads are read through
`GET /api/support-messages/staff?user_id=`, which uses the same secret as the reply route.
Rotation: put the new key in `DATA_ENCRYPTION_KEY` and the old one in `DATA_ENCRYPTION_KEYS_OLD`
(comma-separated), then re-run the backfill once it can re-encrypt (it only converts plaintext
today). The import worker, once it exists, decrypts with `decryptField(value, fieldContext.*)`.

Not covered: chat media files (the private `chat-media` bucket), `message_reports.details`,
`store_payout_accounts.account_name` (nothing writes it yet), and the legacy
`stores.shopify_access_token` column (nothing writes it; the backfill reports any rows left).

---

## 2. Needs a decision

### 2.1 OAuth `state` has no per-session nonce

`api.shopify.install.tsx`, `api.instagram.connect.ts`. Both are authenticated POSTs, but
`state` still can't prove the browser finishing the callback is the one that started it — a
seller with their own account could phish another seller into authorizing and land the
victim's token under the attacker's store. Fix is a single-use nonce tied to
`(user_id, store_id)` plus an httpOnly cookie the callback checks. Nothing calls these routes
in the UI yet, so it's not urgent, but it's the most serious thing still open.

### 2.2 Two-factor auth

Supabase supports TOTP; 0 factors enrolled, no enrolment UI or recovery codes. Should be a
launch gate for sellers holding bank details.

### 2.3 Apple sign-in · code done, dark behind `APPLE_SIGN_IN_ENABLED`

Wired and merged in `src/lib/auth.ts`, hidden because a disabled provider makes Supabase
return a raw "Unsupported provider" error into the UI. Flip the const once the Apple
Developer Program account is live.

**Blocked on ID verification** — Apple's individual enrollment rejects the Nigerian NIMC
card outright ("document type isn't supported"); needs a passport or driver's licence.

Traps that will cost real time if not known when this resumes:

- **Never start a second Apple team.** The user identifier is scoped to the team, not the
  client — a new team means every existing user is a new person to Supabase. Convert
  Individual → Organization instead (an Apple support request; preserves Team ID/certs/keys).
- **Domains field ≠ Return URLs field**, different formats: `lzyflkrqexxuyxyudvbw.supabase.co`
  (no protocol) vs. the full callback URL. Register only the callback that exists today —
  Apple rejects any `redirect_uri` it doesn't already know, so a future custom-domain move
  needs the new callback added *alongside* the old one before activating, not instead of it.
- **The client secret expires at 6 months and fails silently for everyone.** Record the real
  expiry the day it's generated and calendar a reminder two weeks out.
- Costs ~₦43,900/yr (Nigeria-tier pricing, not the $99 US price).

### 2.4 Where "How did you hear about us?" sits in the flow

Currently interrupts the middle of all three onboarding flows; attribution is usually better
collected after the user has something to lose. One-line move in `FLOWS`
(`src/lib/onboarding-flow.ts`) — stayed put because it's a product call, not a bug.

### 2.5 Size chart — coverage holes, not architecture

`size-chart-config.ts` + `SizeChartSheet` are real and persist actual cm measurements to
`product_size_measurements`. The tree was trimmed 2026-09-26 (Apparel & Accessories → Fashion,
880 leaves → 426; the Fashion branch alone went 627 → 173). What's left is coverage: leaves
with no guide (Blouses, Sweaters, Jackets, Maxi Dresses, Kids' Tops, …) still get the blank
manual sheet. The planned fix is preset measurement lists for those, not more artwork. Three
categories stay manual on purpose, not as gaps to close:

- **Footwear** — a shoe has no lettered spans to measure; `SHOE_SIZE_SYSTEMS` replaces the
  clothing ladder in the manual picker instead.
- **Costume sets, capes & cloaks, accessories** — no single chart fits a bundle or a drape.
- **Bodycon dresses** — the guide artwork labels two different spans both `B`; needs
  relabelled art, not a chart definition.

`size-chart/IMAGE-COMPLAINTS.md` records which guide art already in that folder was left
unwired on purpose, and why — check it before wiring more.

---

### 2.x Orders tables are live, ahead of the code (2026-10-07)

`supabase/migrations/20261007120000_orders_checkout.sql` was applied to the **live** project
by Diadem's explicit say-so (Supabase branching needs the Pro plan, so there was no test copy).
Additive only: `store_shipping_settings`, `buyer_addresses`, `orders`, `order_items`,
`order_payments`, `payout_ledger`, all RLS-on, reads scoped to the buyer/seller, **no write
policies** (every write goes through a server route on the service role). Nothing in `main`
reads or writes them yet; the code is on `feature/orders-checkout`. `my-supabase/types.ts` was
regenerated on that branch to include them. If `main` regenerates types first, resolve the merge
by regenerating, not by hand. Payments are planned for Paystack (see `ORDERS-HANDOFF.md`).

## 3. Small, unblocked

### 3.1 Fonts don't match the landing

Landing uses Archivo Black + Inter; onboarding uses Cormorant Garamond for headings. Last
brief was colour only, so left alone deliberately — the two will read as different products
side by side until someone picks this up.

### 3.2 Session tokens live in localStorage · by design, for now

Standard for a Supabase SPA. Moving to httpOnly cookies means an SSR cookie-auth rewrite
across every route — not worth it before launch, worth knowing.

### 3.3 `payoutSet` answers for the wrong store when a seller has two

`use-store-setup-status.ts`'s payout signal comes from `/api/store/payout`, which resolves to
the seller's *oldest* store (`requireOwnStore`) while the hook's other signals are scoped to
whichever store is *active*. A two-store seller's checklist can show store A's payout account
as store B's. Harmless today — `stores` has no unique constraint on `owner_id`, so two-store
sellers are possible but rare. Fix: pass the active `storeId` and switch the handler to
`requireStoreAccess`. Touches an `api.*` route and server auth — wants a review, not a
drive-by.

### 3.4 A video draft loses its saved sound track

Repro: camera in Video mode → after-shot → Sound → pick a track → save as draft → reopen from
Drafts. The track is silently gone. Cause: after-shot never sets `media.origin`, so
`editorFor` (`create.drafts.tsx`) sends the draft to the video editor, whose audio model is a
mixdown baked into the MP4 — it has nowhere to put a detached `audio_url` and drops it. Fixing
it properly means giving the video editor a detached-audio concept it doesn't have; gating
Sound to photos-only in after-shot would remove something that works today (posting a video
with a track is fine — only the draft round trip loses it). Data loss, not a licence
breach — nothing republishes without its credit, which is what makes it safe to leave for now.

---

## Decided against — don't reintroduce

- **Sellers uploading their own audio file to a post.** Removed 2026-09-11, four days after
  shipping. Oakmonte would be *hosting and distributing* the track under a post selling
  something — commercial distribution we hold no licence for, with no takedown process to
  back it up. Use the sound catalogue (`sound-providers/`) instead; if voiceover or
  brand-owned audio comes back, build it as in-app recording, not a file picker.
- **A device-audio picker anywhere in the create flow.** Same reasoning as above — removed
  from the camera, photo editor, video editor and (2026-10-06) the studio, whose Sound tool
  now opens the library's Music / Effects sheet instead.
- **Mixed photo/video carousels.** A carousel is photos-only. The video editor already exists
  to weld multiple clips into one MP4; a second, worse way to combine clips would compete
  with it, and the feed can't decide whether a mixed post is swiped or watched.

## Not a bug — do not "fix" these

- **`profile_stats` and `public_profiles` show as Supabase advisor ERRORs**
  (`security_definer_view`). Both are deliberately plain views exposing only non-sensitive
  columns (follower counts; username/display name/avatar/bio) — false positives for this
  design.
- **Hard-refreshing `/create/after-shot/studio` drops a pending capture.** The camera handoff
  is an in-memory module variable because the payload is a `Blob`, and client-side navigation
  never reloads the page.
