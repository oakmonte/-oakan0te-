# Postponed

Everything deliberately deferred, plus the things that turned out to be deferred by
accident. Nothing here is a bug report you need to triage — it is the list you asked for
so the pile stops living in chat history.

Ordered by what stops a launch, not by when it came up. Last updated 2026-09-17.

Legend: **[BLOCKS LAUNCH]** · **[NEEDS A DECISION]** — I cannot pick for you, it changes
the schema or costs money · **[SMALL]** — do it any afternoon · **[BY DESIGN]** — noted so
nobody "fixes" it later.

---

## 0. Recently landed

### 0.1 Carousel posts · [DONE — 2026-09-06]

`post_media` (one row per item, `position` 0-based) plus `posts.media_bytes` and
`posts.created_with`. Applied to `lzyflkrqexxuyxyudvbw`; migrations
`20260906120000` and `20260906120100`.

Expand step only — `posts.media_url` / `media_type` / `thumbnail_url` are still
written with item 0 as the cover, so every reader that wants one image keeps
working untouched.

**On the "contract migration" that was said to be owed: don't do it.** The
recommendation has changed on inspection. The readers still on those columns —
the profile grid, the media pickers, the drafts page — each want exactly one
image to put in a square, which is what those columns hold. Dropping them would
force all three to join `post_media` and filter `position = 0` to get something
they already have for free. The honest fix is a rename, not a deletion: treat
them as a documented **cover cache**, kept deliberately denormalised. The real
risk is a new screen reading `posts.media_url` and silently showing one photo of
five — which is a code-review habit, not a schema problem. Decide before
launch: rename to `cover_*`, or leave the names and rely on the comment.

- **Carousels stay photos-only. [DECIDED — 2026-09-07]** `post_media.media_type`
  accepts "video" because it was cheaper to allow than forbid, but nothing
  produces a mixed carousel and nothing should. The video editor exists to weld
  many clips into one MP4; a second, worse way to put several clips in a post
  would compete with it, and the feed can't decide whether a mixed post is
  swiped or watched. Live photos already cover "a moving thing in a photo post",
  which is why one owns the whole post. Consequence: per-item posters
  (`post_media.thumbnail_url` is only set for item 0) need no fixing — a photo
  is its own poster. RLS on `post_media` mirrors
  `post_product_tags` exactly; none of the twelve tables in 1.1 were touched.

Wired end to end: the photo editor bakes every photo in its carousel, the
publish screen ships them as repeated `files` + a positional `mediaTypes`
array, `api.posts.ts` uploads them in order and writes both tables, and the
feed renders a snap-scrolling carousel with dots.

### 0.2 Sound on a post · [DONE — 2026-09-07, video editor 2026-09-11]

`posts.audio_url` / `posts.audio_name`, migration `20260907090000`, applied to
`lzyflkrqexxuyxyudvbw`. Additive; every existing row reads as null and behaves
exactly as before.

The track is **not** mixed into the media — it is uploaded beside it and the
feed plays it while leaving the media muted. That is what lets a still, or a
carousel of six stills, carry a song without any of it becoming a video, and it
keeps the export pipeline (which knows nothing about this) at one generation of
re-encode. Because a video post's music is baked into its MP4, `audio_url` and
baked music are mutually exclusive by construction: nothing can play twice.

Chosen in the photo editor (Sound in the tool row → the catalogue sheet), shown
as a chip with play/pause so it can be auditioned before it goes out, carried to
publish in the capture handoff, and restored when a draft with a sound is
reopened.

Available on **both** editors. The after-shot screen (the camera's path) had a
Sound button in its toolbar with nothing behind it — tapping it did nothing at
all. It now opens the same picker and shows the same chip, so the camera path
isn't the one that can't add a song.

The other dead button in that toolbar, **Link**, has since been removed — see
0.4.

**Sound library · [FIRST PROVIDER LIVE — 2026-09-10]** — Sound opens a
catalogue. It is the **only** way to put a sound on a post.

**Uploading your own audio file was removed on 2026-09-11 · [DELIBERATE — do
not restore]**. It was shipped on 2026-09-07 and taken out four days later, so
the reasoning matters more than usual:

- Oakmonte does not link to the file, it **hosts** it — on our own CDN under
  `posts/<user>/<post>/audio.<ext>`, served publicly to every viewer, beneath a
  post advertising an item for sale. That is Oakmonte distributing the track
  commercially, not a user sharing one.
- We hold no music licences and run nothing like Content ID. Instagram and
  TikTok allow this because they bought the right to; we have not.
- The takedown posture it would depend on does not exist yet. `terms.tsx`
  promises an IP contact address that is still a literal `<Placeholder>`, and
  there is no report flow anywhere in the app.
- Its realistic user was the harmful case. The whole reason the catalogue was
  built is that "has an mp3 lying around" describes almost nobody — so the
  seller reaching for that button had gone and _got_ a commercial track.
- It cost nothing to remove: the posts table held **0 rows**. In six months it
  would have meant pulling music off live posts.

What was genuinely lost is voiceover and brand-owned audio. The right shape for
those is **recording a voiceover in-app**, not a file picker — clean by
construction, and more use to a seller than a stranger's mp3. The upload path
is deliberately still there underneath (`CaptureAudio.blob`, the `audio` field
in `api.posts.ts`) with nothing setting it, so that feature does not have to be
rebuilt from both ends. Note this also means an authenticated seller could
still POST audio bytes directly, bypassing the UI — a narrower problem than a
button inviting it, and Diadem has not asked for it to be closed.

Wikimedia Commons is the first provider (`src/lib/sound-providers/wikimedia.ts`,
searched through `api.sounds.ts`). It was chosen because it needs no key, no
contract and no negotiation: Commons' own upload policy already requires that
everything on it be licensed for commercial reuse, so there is no per-file
rights question to answer. That made it the right thing to build the plumbing
against while real libraries are being sourced.

Three things about it are worth knowing before touching this code:

- **Commons is not a music library.** It is mostly dictionary pronunciations,
  animal noises and instrument samples — a search for "afrobeat" returns five
  German Wiktionary recordings of the _word_ before it returns any music. What
  saves it is that Commons absorbed a bulk import of the Free Music Archive,
  and those files are real music tagged by genre, which is what `SOUND_GENRES`
  browses. Free-text search across the rest is deliberately the secondary path.
- **Never serve the original file.** Commons stores audio as Ogg Vorbis, Opus
  and FLAC, none of which Safari on iOS plays. Every file has an MP3 transcode
  and `playableUrl` returns only that. Getting this wrong gives a library that
  works perfectly on a laptop and is silently dead on half the phones.
- **Duration is the quality filter.** `MIN_TRACK_SECONDS` removes essentially
  all the noise above, because a pronunciation is two seconds and a song is
  not. It is doing more work than it looks like it is.

**Three providers now, searched together · [2026-09-11]** — `api.sounds.ts`
queries every configured catalogue at once and interleaves the results, a track
at a time from each. A seller wants a song, not a source, so the picker never
asks which archive to look in. One source being down costs some choices, not
the feature (`Promise.allSettled`; only an empty board is an error).

- **Wikimedia Commons** — live, no key.
- **ccMixter** — live, no key. A remix community, so unlike Commons everything
  on it is already music. Its hazard is the mirror of Commons': ccMixter is
  full of `by-nc`, which a shop cannot use, so the query pins `lic=open` and
  the shared licence check runs again on the way out.
- **Jamendo** — live, **verified against the real API on 2026-09-11**, and
  needs `JAMENDO_CLIENT_ID` (app "Oakmonte's App" is registered). Without the
  key the provider skips itself rather than erroring.

**Jamendo is mostly unusable to us, and the query is what fixes it.** Measured
live: a lo-fi page without licence filters is 25 `by-nd` and 3 `by-sa` out of
30, so the shared licence check discarded 28 of every 30 tracks and the genre
looked empty. With `ccnc=false&ccnd=false` the same page comes back 30 out of
30 usable. Note `audiodlallowed` is NOT a recognised parameter on `/tracks/` —
Jamendo warns and ignores it — so the download-permission check has to happen
in `parseSearchResponse`, where it does.

**Still open on Jamendo: their API terms, not the music.** The tracks are fine —
we only take CC BY / BY-SA / CC0, granted by the artist directly, so commercial
use with attribution is exactly what they permit and Jamendo cannot gate it.
The service is the question: the free tier is **35,000 requests/month** and is
framed for non-commercial apps, with commercial tiers unpublished and by
arrangement. The full API Terms of Use page 404s, so this needs asking rather
than assuming. At our 5-minute cache, 35k/month is comfortable at a few hundred
active sellers and tight at a few thousand.

**The licence check is an allowlist, not a deny-list, and that was a real
bug.** It used to pass anything not matching non-commercial or no-derivatives,
so a licence we could not name read as usable. Asking ccMixter for a reduced
field set silently drops `license_name` and turns a whole page into "Unknown
licence" — under the old rule every one of those published, NC tracks
included. Now a licence must be affirmatively recognised. Wrongly hiding a
usable song is a missing row in a picker; wrongly publishing an NC one is a
seller's problem with a rights holder.

**Device audio is gone from all three create flows.** The camera's "use a sound
from your phone" row went on 2026-09-10; the video editor's "Choose an audio
file" went on 2026-09-11 and was the last one. The reasoning is the same in
both places and it is worth restating because the video editor looked like the
exception: mixing a track into an MP4 that Oakmonte then serves publicly under
a post selling something is Oakmonte distributing it commercially, which is
exactly what we hold no licence for. That the file never sits in storage on its
own changes nothing about who is publishing it.

**Still wanted:** a catalogue anybody would recognise. All three sources are
legally clean and none of them is famous. Adding a fourth is one module in
`sound-providers/` plus a line in its registry: normalise into `LibraryTrack`,
map the shared `SOUND_GENRES` onto its own taxonomy, add its media host to
`TRUSTED_AUDIO_HOSTS`, and the picker, credit and upload path work unchanged.

**Attribution is a correctness requirement, not a nicety** (migration
`20260910120000`). A CC BY track is licensed _only while the artist is
credited_, so `posts.audio_attribution` / `audio_licence` / `audio_source_url`
travel with the post, survive a save-to-drafts round trip, and render in the
feed. When Commons does not state whether a credit is owed, the inference errs
towards crediting — naming someone who placed their work in the public domain
costs nothing; failing to name someone who required it is the actual failure.

**A library track never touches the phone — except in the video editor.** On
every other screen it is handed to the upload as a URL and the server copies it
into Bunny (`fetchTrustedAudio`, now in `src/lib/trusted-audio.server.ts`).
Commons MP3s run 3-5 MB, so downloading one to the browser only to upload it
again would cost a seller on mobile data about eight megabytes to attach a
song. That is also why `isTrustedAudioSource` is an exact-hostname HTTPS
allowlist: a request field deciding what our server fetches is the shape of
every SSRF hole ever written.

The video editor cannot work that way, because it welds the music into the MP4
rather than uploading it beside the media — `OfflineAudioContext` needs the
actual bytes. `/api/sound-file` streams one track to the browser through the
same allowlisted server-side fetch, auth-gated for the same reason
`/api/sounds` is: an open relay costs us the bandwidth. It is deliberately not
a general proxy.

That baked-in track still has to be credited, and there is no `audio_url` to
hang the credit on. `audioBakedIn=1` on the publish request is what says "the
media already contains this" — no bytes stored, the three credit columns
written anyway. `PostFeed` shows the credit line on attribution alone rather
than on `audio_url`, and appends the autoplay prompt only when there is a
second source to unblock.

**Not yet done here:** no infinite scroll (the route returns `nextOffset` and
nothing calls it — one page of ~40 per genre is what a seller sees); no link
through to the source page from the feed, because the feed card's tap surface
is already the play/pause control and an anchor inside it would fire by
accident — `audio_source_url` is stored and waiting for a post detail view.

**Known gap: a video draft loses its track.** Repro — camera in Video mode →
after-shot → Sound → pick a track → Save as draft → Drafts → tap it. The track
is gone, silently.

The cause is older and wider than the sound library. After-shot never sets
`media.origin`, so its posts store `created_with = null`; `editorFor` in
`create.drafts.tsx` then falls back to `media_type`, which sends the draft to
the **video editor** — a screen whose audio model is a _mixdown into the MP4_,
not a detached track, so it has nowhere to put `audio_url` and drops it.

Deliberately not fixed here, and the reason is the shape of the fix rather than
the size. The two options are to gate Sound to photos in after-shot, which
removes something that works today (posting a video with a track is fine — only
the draft round trip loses it), or to give the video editor a detached-audio
concept it does not have. The second is the right answer and it is a change to
the video editor's session and publish path, not to this feature.

Worth knowing: the failure is **data loss, not a licence breach** — the
republished post carries no audio at all rather than an uncredited track, so
nothing ships without its credit. That is what makes it safe to leave.

Half of that fix now exists (2026-09-11): the video editor takes catalogue
tracks and carries their credit, and `/api/sound-file` already accepts our own
pull zone as a trusted host — so a draft's stored `audio_url` can be fetched
back into the timeline by the same path a fresh pick takes. What is still
missing is the restore itself: `create.drafts.tsx` hands the video editor
media and never looks at `audio_url`.

The _baked-in_ case is fixed, and it had to be: a video-editor draft has its
music inside the MP4, so reopening and republishing one carried the track into
the new post while the credit columns came back null — music published without
its attribution, which is the breach rather than the data loss. The editor now
reads `audio_licence` with no `audio_url` as "already welded in" and holds an
`inheritedCredit` that survives session parking and is re-sent as
`audioBakedIn=1`. Caught in review, not by a test — nothing tests a draft round
trip.

**The rest of that review is closed too** (same day). `/api/sound-file` now
takes a signed URL: `/api/sounds` stamps each track with an HMAC _after_
`isUsableTrack` and `isLicenceUsable` have run, and the proxy refuses anything
unstamped — so an allowlisted host is no longer enough to pull a track the
picker filtered out. Signing rather than re-resolving the id upstream was
deliberate: re-resolving costs a provider request per pick against Jamendo's
35,000-a-month free tier, and proves less ("this id is usable now" rather than
"this URL is one we offered"). The key derives from a secret the server
already holds, so there is no new env var to forget; `SOUND_URL_SIGNING_KEY`
overrides it if the two should rotate separately. `sound-url-signature.test.ts`
covers it, because a verify that wrongly returned true would break nothing
visible.

There is also a per-user rate limit, and it is honest about being a brake
rather than a guarantee: the counter lives in one isolate's memory, so several
isolates mean several counters and a cold start forgets. A real limit needs
shared state — a Durable Object or a table — and is worth building when there
is traffic to justify it.

Undo/redo now covers the music track. Removing one was the only destructive
action on that screen undo could not take back, and re-picking costs another
trip to the catalogue and several megabytes of somebody's mobile data.

The feed has **no volume control**, deliberately: autoplay is the only sound the
app makes and the tap surface already stops it. First playback in a session is
blocked by autoplay policy until a gesture, so the caption line reads "Tap for
sound" until it isn't.

### 0.3 Live photos · [DONE — 2026-09-07]

A short silent clip that loops — a photo-editor product, not a video-editor
one. **No schema change**: it stores as `media_type: "video"` with
`created_with: "photo-editor"`, which is also what routes it back to the right
editor from Drafts and what suppresses the play badge on its tile.

Two ways to make one, per your call:

- **Camera** — hold the shutter in Photo mode (350ms to trip, auto-stops at
  `LIVE_MAX_SECONDS`). Photo mode's stream is opened without an audio track, so
  a live photo is silent by construction. Routes to the photo editor rather
  than after-shot, via the existing capture handoff.
- **Photo editor** — pick a clip up to 6s from the device.

A live photo **owns the whole post**: it cannot share a carousel with stills,
enforced in both directions (the picker refuses the mix, the + button is hidden
beside one). Mixing them would mean a post that is sometimes swiped and
sometimes watched, and the feed can only pick one.

Editing goes through `exportComposite`, so the same filter/crop/layers/adjust
stack applies through the video encoder — and an unedited live photo
short-circuits to the bytes that came in, spending no second generation of
compression. Fixed on the way: **`exportVideo` never took `adjustCss`**, so a
tone adjustment on any clip — including on the after-shot screen, long before
this — was silently dropped between the preview and the exported file.

`LIVE_MAX_SECONDS = 6` in `src/lib/photo-carousel.ts` is the single knob.

### 0.4 Posts can't point off-platform · [DONE — 2026-09-07]

`src/lib/content-policy.ts` — one module, because the text tool is shared by
three editors and a rule living in three places means three things within a
month. Refuses links, email addresses, phone numbers, `@usernames`, and
Instagram/insta/IG/TikTok/WhatsApp/Snapchat/Telegram. It **refuses, it never strips** — silently deleting
what someone typed just gets retyped, with nothing on screen saying why.

It **absorbed an earlier version of this file** that only the product
description sheet used, so its profanity list and its "dm me / call me / text
me" phrases live on here — profanity keeps its own sentence in the message,
since "take out the swearing, buying stays on Oakmonte" reads as nonsense.

Enforced at: the shared text tool (after-shot, photo editor, video editor), the
studio's timed captions, the publish caption, and the product description sheet.

The false-positive guards matter more than the patterns, since this fires on
sellers writing honest sentences. A run of digits is a phone number only at 9+
digits **and** with one unbroken group of 4 — which is what lets "sizes 6 8 10
12 14 16 18 20 22 24" and "₦1,500,000" through while catching 08012345678. Bare
domains need a real TLD. "ig" is whole-word, so "Big" and "Igbo" are fine. Our
own `oakmonte.*` links are allowlisted.

**Two deliberate exceptions**, both recorded here because they are the places
someone will later think the rule is broken:

1. `@name` is allowed **in the post caption only**, where `@` is Oakmonte's own
   mention affordance (there's a button that types it). `@shop` next to "ig" is
   still refused — the platform word is caught on its own.
2. **"snap", "tg" and "wa" are not on the list**, though Snapchat, Telegram and
   WhatsApp are. This is a clothing marketplace: snap buttons, snap fastenings
   and snapped photos are ordinary things to write, and two letters is not
   enough signal to accuse anybody of anything. `wa.me` and `t.me` — how those
   two actually get shared — are already caught as links.

Also removed: the **Link** button from the after-shot toolbar. Product linking
lives on the publish screen, and that button had never been wired to anything.

### 0.5 Support messaging ("Oakmonte Labs" chat) · [migration NOT applied — 2026-09-09]

Built jointly — GitHub Copilot did the chat UI + migration, Claude Code added the
support-side reply route after — recorded here so neither tool loses track of the other's
half. `src/routes/messages.tsx`'s "Oakmonte Labs" chat loads, sends, and live-subscribes
against a real table instead of local-only state. Migration
`20260909100000_add_support_messages.sql` (committed) creates `public.support_messages` —
`user_id` FK to `profiles`, `body` checked 1-4000 chars, `sender` `'user'|'support'`, RLS
policies scoping select/insert to `user_id = auth.uid()` and forcing `sender = 'user'` on
insert — plus Realtime via `alter publication supabase_realtime add table`. Uses the
correct client (`my-supabase`, not the Lovable Cloud stub).

`src/routes/api.support-messages.reply.ts` is the support-side write path the insert policy
above deliberately doesn't allow browser-side: gated on a shared secret
(`SUPPORT_REPLY_SECRET`, `X-Oakmonte-Internal-Key` header — see the `supabase-data-access`
skill's Secrets list) plus a signed-in session, then writes `sender: "support"` via
`supabaseAdmin`. Known, accepted gap: this authenticates "a trusted caller," not which
staff member — there's no per-staff identity system yet, and none is planned until this
actually needs one.

**Still not applied to `lzyflkrqexxuyxyudvbw` — the one remaining blocking step, and not a
Copilot task.** Copilot Chat has no live database access, only file edits. Needs either the
Supabase dashboard/CLI, or `mcp__supabase__apply_migration` from a Claude Code session —
ask before running it, same as 1.1 below; it's a schema change to a live project.

Checked and fine: the migration has no explicit `ENABLE ROW LEVEL SECURITY` line, but
`rls_auto_enable()` (`20260820160000_harden_rls_auto_enable.sql`) turns RLS on for every
new `public` table automatically, so the two policies will actually be enforced once this
lands — this isn't a gap.

One real follow-up once it's applied: regenerate `src/lib/integrations/my-supabase/types.ts`
(`mcp__supabase__generate_typescript_types`), then delete both `messages.tsx`'s AND
`api.support-messages.reply.ts`'s hand-rolled `MessagingDatabase` type + cast — a stopgap
for a table the generated types don't know about yet, not a pattern to keep around.

### 0.6 "Get the webapp" is a store-setup step · [DONE — 2026-09-17]

The install is no longer left to chance. It is card 3 of the seller checklist
(`src/routes/store.index.tsx`), sitting immediately after "Pickup locations", with its own
page at `/store/get-the-webapp` (`src/routes/store.get-the-webapp.tsx`). Android gets a
real one-tap install button; iOS gets Share -> Add to Home Screen instructions, because
there is no programmatic install on iOS and no API that changes that.

**Completion is auto-stamped only — there is deliberately no "I've installed it" button.**
`stampInstalledApp` (`src/lib/installed-app.ts`) writes `installed_app: true` to Supabase
`user_metadata` from `__root.tsx`, and only when actually running standalone. Metadata
rather than localStorage for the reason that is this whole feature's subject: the installed
iOS app has its own storage jar, so a flag written in Safari is invisible to the app and
vice versa. Metadata follows the account across that boundary. Same reasoning, same shape
as `passkey_prompted`.

Consequences worth knowing before anyone "fixes" them:

- **On iPhone the tick lands late, on purpose.** The installed app starts signed out, so the
  stamp cannot happen until they sign in inside it. That delay is exactly what the passkey
  offer two steps earlier is for — see `store.finance.tsx`'s comment, which now records the
  dependency. The explainer video on the step page tells them to carry on from the app.
- **The card is hidden entirely on desktop** (`isInstallablePhone` in `src/lib/platform.ts`,
  which is now the file's second OS branch). A laptop cannot install anything, so the card
  would be a permanent blocker with no way through. Four steps on a laptop, five on a phone.
- **`installedApp` is deliberately NOT part of `complete`** in `use-store-setup-status.ts`.
  `complete` gates the profile page's seller prompt; if the install counted, a desktop-only
  seller could never satisfy it and would be re-nagged every session with no card on screen
  to explain why. `complete` means "this store can sell", not "this person has the app".
- Tapping a later step from a browser tab raises a "Finish this from the app" prompt rather
  than the generic order warning. Still a nudge with a tap-through, never a block.

`beforeinstallprompt` is captured at the root into a module variable, not in the step
page's own effect — it fires during page load, so a route-level listener has already missed
it and the button silently degrades to instructions, which looks like it works.

**Owed: the explainer clip.** The page points at `/get-the-webapp.mp4` in `public/` as a
plain string path — deliberately not an `import`, since an unresolved asset import fails
`bun run build` (a failed Vercel deploy) while passing the other three gates. Until the file
is dropped in, `onError` hides the player and the page still reads correctly.

Same commit: the auto-opening seller prompt on the profile page dropped its second button,
"Upload or create content", which navigated nowhere and only closed the dialog — a choice
between doing something and doing nothing wearing the costume of a real fork. It now names
the next outstanding step (`nextStepLabel`, derived in the hook so it cannot drift from the
checklist) and offers one action.

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

What's left is coverage, not architecture. **50 guide images** are wired across 94 category
mappings (tops, jerseys, joggers, trousers, jeans, shorts, jackets, skirts, jumpsuits, corsets
and bodysuits). Dresses are now largely covered too — A-line, mini, off-shoulder, shirt, slip
and wrap dresses each have their own guide. Add more by extending `CHARTS_BY_CATEGORY` +
`GUIDE_IMAGES`, same pattern as the existing entries.

Three known holes remain, each for its own reason (audited 2026-09-22):

- **Footwear will never get a chart of this kind** — a shoe isn't measured by lettered spans
  across a flat-laid garment. What it needed was the right ladder in the manual picker, and it
  now has one: `SHOE_SIZE_SYSTEMS` (US/UK/EU shoe numbers) replaces the clothing S/M/L + dress-size
  ladder for `shoes` and `costume-shoes`, selected via `isFootwearCategory`. Free-form cm
  measurements ("Foot length") still come from `ManualSizeOnlySheet` as before.
- **Costumes** are now wired where a costume garment measures like its everyday counterpart:
  `costume-tops` borrows the generic top guide, `costume-dresses` the A-line dress guide, joining
  `costume-onesies-jumpsuits` which already borrowed the jumpsuit guide. Still unmapped on purpose:
  `costume-sets` (a top-plus-bottom bundle has no single chart), `costume-cloaks-capes` (a drape
  has no chest/shoulder span), and `costume-accessories` / `costume-wigs` (not sized garments).
- **Bodycon dresses** stay on manual pick. `Bodycon-dress guide.png` is a genuine bodycon dress
  (the older "might be a jumpsuit" note was wrong), but the artwork labels two different spans
  **both as `B`**, so a seller cannot tell which box is which. It needs relabelled artwork, not a
  chart definition. See `IMAGE-COMPLAINTS.md`.

`src/components/product-form/size-chart/IMAGE-COMPLAINTS.md` is the audit of the guide artwork
that is present but deliberately **not** wired, with the reason for each: bomber and track
jackets, sweater vests, camisoles, blouses and tube tops all need their own measurement
definitions because their label sets don't match the shared five-line top chart, and several
corset/bodysuit files are near-duplicate rear views of guides already registered. Tube Tops has
no category at all yet. Read that file before adding artwork — it will tell you whether the image
you're about to wire was skipped on purpose.

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

### 2.7 Apple sign-in · [CODE DONE, DARK — waiting on the Apple account, 2026-09-16]

Fully wired and merged, hidden behind `APPLE_SIGN_IN_ENABLED` in `src/lib/auth.ts`. Flip that
one const to `true` once the Apple Developer Program account is live and the provider is
enabled in Supabase. Hidden rather than merely broken because a disabled provider makes
Supabase return a raw "Unsupported provider" error straight into the UI.

Costs **₦43,900/yr on the Nigerian storefront** — about $32 at Sept 2026 rates, not the $99 US
price, because Apple sets regional tiers and hasn't repriced Nigeria as the naira moved. Assume it
climbs at some renewal. It only benefits iOS users, since Google-on-Android and email already work. Enrollment has to be done by an adult (the account holder accepts the
licence agreement in their own name), and Individual → Organization later is an Apple support
request, not a setting.

Console setup, in order: Team ID → register `oakmonte.store` as an email source → App ID with
the Sign In with Apple capability (leave the server-to-server endpoint blank, Supabase Auth
doesn't support it) → Services ID, description **`Oakmonte`**, which is what users read on the
consent sheet → Website URLs on that Services ID, which are
`lzyflkrqexxuyxyudvbw.supabase.co` and
`https://lzyflkrqexxuyxyudvbw.supabase.co/auth/v1/callback` — **not** `oakmonte.store`, which
is why no `.well-known` file is needed here → signing key, `.p8` downloadable once.

**Blocked on ID verification, 2026-09-16.** Apple's individual enrollment requires a valid photo
ID and rejects the **Nigerian NIMC national identity card** outright — "document type isn't
supported", not a scan failure, so retrying is pointless. Accepted: passport, driver's licence.
Whoever enrolls needs one of those, in date. This is the only thing standing between the repo and
working Apple sign-in; everything else is built.

**Never start a second Apple team.** Apple's user identifier is scoped to the developer _team_,
not the client, so moving to a different team changes `sub` for every user and Supabase sees them
as new people — everyone loses their account. The account is enrolled as an Individual under a
parent's Apple ID, and the migration path is **Individual → Organization conversion**, which
preserves the Apple ID, Team ID, certificates and keys (only the seller name changes). It is a
support request from Membership Details needing a company name, legal address and D-U-N-S number
— gated on the LLC existing, **not** on anyone's age, so it can happen as soon as the entity does.
Converting is also what makes team members possible at all; Individual accounts cannot have them.

That Apple ID is therefore a single point of failure for every Apple login on Oakmonte. Two-factor
on it, a trusted number both parties can reach, and the `.p8` + Team ID + Key ID stored somewhere
the project controls rather than only on one person's device.

**No domain verification, and no Supabase Pro.** Apple's Services ID panel offers a
`.well-known/apple-developer-domain-association.txt` download, and you obviously cannot host a
file on `lzyflkrqexxuyxyudvbw.supabase.co`. That file is for Sign in with Apple **JS** and for
email-relay domains; the server-side OAuth redirect flow Supabase uses only needs the Return URL
registered. Supabase hosts no such file on any project host (404, checked 2026-09-16) and its own
documented setup names `<ref>.supabase.co` as the domain, so this is the normal path for every
project on every plan. Pro buys a nicer hostname, nothing more.

The two fields are separate values in different formats, and registering one does not imply the
other:

```
Domains and Subdomains:  lzyflkrqexxuyxyudvbw.supabase.co      <- no https://, no trailing slash
Return URLs:             https://lzyflkrqexxuyxyudvbw.supabase.co/auth/v1/callback
```

A protocol or trailing slash in the domain field gives "Invalid domain".

Register **only** the callback URL that exists today. If the Supabase domain ever changes — a
vanity subdomain or a custom domain — Supabase Auth starts advertising the new callback the
instant it is activated, and Apple rejects any `redirect_uri` it doesn't know, so Apple sign-in
breaks on activation. The fix is additive and takes two minutes: add the new callback URL to the
same Services ID **alongside** the old one, then activate. Same for Google's authorized redirect
URIs. Don't pre-register domains you don't own yet — Apple wants to verify them and they won't
resolve.

Both branded options need Pro ($25/mo), not the $10 the add-on page shows: a custom domain is
Pro + $10, and a vanity subdomain is free but still Pro-only. Note `oakmonte.supabase.co` is
first-come-first-served across all Supabase users and cannot be reserved without claiming it.

**The client secret expires after at most 6 months and Apple sign-in then fails silently for
everyone**, with no warning from Apple or Supabase. Record the real expiry date here the day
it is generated and set a calendar reminder a fortnight before. Rotating needs the `.p8`, the
Team ID and the Key ID, which is the whole reason to keep that file.

Once live, verify the assumption `needsPasskeyForInstall` rests on: an Apple account should
sign in on the installed iOS app with Face ID and no password, and should never see
`/passkey`.

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

### 3.8 `payoutSet` answers for the wrong store when a seller has two · [SMALL]

Found reviewing the install-step work on 2026-09-17, deliberately not fixed in that commit —
it predates it and the fix is an API change, not a UI one.

In `src/hooks/use-store-setup-status.ts` the payout signal comes from
`authedFetch("/api/store/payout")`, which carries no store id. That endpoint uses
`requireOwnStore` (`src/lib/server-auth.ts`), which resolves to the seller's **oldest**
store. The hook's other three signals are all scoped to the `storeId` argument — the
_active_ store on `store.index.tsx`. So for a seller who owns two stores, the checklist
shows store A's payout account as store B's.

Consequence: B's card reads "Payout account added — pending verification" for an account B
does not have, `handleStepTap` treats step 1 as done so no order warning fires, and the
profile prompt's `nextStepLabel` names the wrong next step for a store that cannot be paid
at all. Harmless for single-store sellers, which is everyone today — `stores` still has no
unique constraint on `owner_id` (see 1.3), so two-store sellers are possible but rare.

Fix: pass the active `storeId` on the request and switch the handler to `requireStoreAccess`
instead of `requireOwnStore`. Touches an `api.*` route and server auth, so it wants the
`supabase-data-access` skill and a review, not a drive-by.

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
