# Postponed

What's deliberately deferred, plus what turned out to be deferred by accident. Not a bug
tracker — a punchlist for what stops a launch. Shipped work isn't listed here; it's in git
history. Only kept here when there's still an open action, or a decision someone could
otherwise "fix" back into a mistake.

Legend: **[BLOCKS LAUNCH]** · **[NEEDS A DECISION]** — schema or money, not mine to pick ·
**[SMALL]** — an afternoon · **[BY DESIGN]** — don't "fix" this later.

---

## 1. Blocks launch

### 1.1 RLS is off · migration drafted, held

The tables the seller dashboard writes to directly from the browser have no row-level
security — the publishable key can read and write every seller's catalogue, not just its
own. Check `mcp__supabase__get_advisors` for the current table list; it grows as new
store-scoped tables are added and a hardcoded count here would just drift.

Store scoping itself is real (`useOwnStores`/`useActiveStore` in `use-own-store.ts`, derived
from the signed-in session) — that's no longer what's blocking this. A full migration (6
`SECURITY DEFINER` owner-check helpers + one policy per table) is written and reviewed, but
held pending explicit sign-off. Ask before applying it — it isn't a "just do it" item even
though the code is ready.

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
`product_size_measurements`. What's left is coverage: extend `CHARTS_BY_CATEGORY` +
`GUIDE_IMAGES` the same way the existing 94 category mappings work. Three categories stay
manual on purpose, not as gaps to close:

- **Footwear** — a shoe has no lettered spans to measure; `SHOE_SIZE_SYSTEMS` replaces the
  clothing ladder in the manual picker instead.
- **Costume sets, cloaks/capes, accessories, wigs** — no single chart fits a bundle or a
  drape.
- **Bodycon dresses** — the guide artwork labels two different spans both `B`; needs
  relabelled art, not a chart definition.

`size-chart/IMAGE-COMPLAINTS.md` records which guide art already in that folder was left
unwired on purpose, and why — check it before wiring more.

---

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
  from the camera, photo editor and video editor.
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
