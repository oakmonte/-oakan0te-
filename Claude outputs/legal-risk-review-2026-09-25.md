# Oakmonte: Legal and Compliance Risk Review (pre-launch)

Prepared 2026-09-25 from a read-only audit of the repository at `/home/komma/Documents/Projects/Oakmonte` (branch `main`, commit `9620723`) plus public-source research.

> **This is not legal advice.** It is an engineering-led issue list meant to make a lawyer's review faster and cheaper. It was not written by a lawyer, and no lawyer has checked it. Nigerian law (NDPA 2023 and the GAID, FCCPA 2018, the Copyright Act 2022, CBN payment rules, ARCON, CAMA 2020) and the platform rules quoted here change often. **Have a Nigerian-qualified lawyer, and ideally a registered DPCO (Data Protection Compliance Organisation), review this and the final Terms, Privacy Policy and Seller Agreement before launch.** Where this review says "likely" or "probably", that is the point where a lawyer's judgment is needed.

---

## 1. Executive summary

Oakmonte is a Nigerian marketplace with a social feed, and most of its users are young. It is about to soft-launch without a registered company, with legal pages still full of visible `[Placeholder]` text, and with a landing page that promises escrow, "vetted" sellers, a dispute pipeline and a satisfaction guarantee. None of those exist in the code yet. The legal pages were written for a product that hasn't been built. What *has* been built creates exposure the pages don't mention: public body photos, seller home addresses readable with the public key, no age gate, and "Report" buttons that do nothing.

The five things most likely to cause real harm or a store rejection:

1. **Personal data exposed with the public key.** RLS is off on `stores` (seller business phone, email, pickup address and exact GPS pin) and on eleven other tables. Full-body photos from `/find-your-fit` go into a **public** bucket under a predictable path and survive account deletion. This is an NDPA s.39 security failure, and the first misuse becomes a notifiable breach (72 hours to the NDPC).
2. **Misleading claims on the live landing page.** "Escrow-protected", "Our guarantee: your money doesn't move until you're happy. No exceptions", "vetted", "★★★★★ Loved by our early shoppers", and named testimonials, all before any payment can be taken. This is FCCPA s.125 territory (misleading representation) and an ARCON issue. It is also the cheapest item to fix.
3. **Children.** Nothing at signup asks for age. The NDPA treats anyone under 18 as a child and requires parental consent where consent is the lawful basis (s.31). The Terms and Privacy Policy leave the minimum age as a placeholder. Young users can upload body measurements, weight and full-body photos.
4. **UGC safety and the app stores.** There is no working report, block or moderation feature. Both "Report" buttons only close their menu. Apple guideline 1.2, Google Play's UGC policy, the NITDA Code of Practice (24-hour takedown) and the Copyright Act 2022 s.55 notice-and-takedown all assume one exists. Without it the mid-November store submissions will very likely be rejected, and Oakmonte loses its copyright safe harbour.
5. **No legal entity, and money flows that may need a licence.** "© 2026 Oakmonte Collective" is not a company, so the founders are personally the counterparty to every user. A Paystack Starter Business cannot make Transfers, so sellers could not be paid out. The Terms say funds are "held by Oakmonte", and holding customer funds generally needs a CBN licence Oakmonte doesn't have. The fix is structural: use Paystack split payments or subaccounts with a delayed settlement, or a licensed escrow partner.

The music library, by contrast, is in unusually good shape. The licence allowlist, the removal of device-audio upload and the attribution columns are all solid. One real legal wrinkle remains: CC BY-SA music welded into a video makes the whole video a BY-SA work. Nothing in the app sets cookies or runs analytics, which also makes the cookie question much smaller than the founder feared.

---

## 2. Prioritized risk table

Severity is a mix of likelihood and impact before launch. Effort: S = hours, M = days, L = weeks or needs outside parties.

| # | Risk | Why it applies to Oakmonte (evidence) | Sev | Concrete fix | Effort |
|---|------|------------------------------------------|-----|--------------|--------|
| 1 | Seller personal data readable and writable by anyone | RLS off on `stores`, `products`, `product_variants` and nine more (POSTPONED.md §1.1), plus `drops` and `drop_products` (`supabase/migrations/20260924130000_add_drops.sql`). `stores` holds `business_phone`, `business_email`, `pickup_address_line`, `pickup_lat`/`pickup_lng` and a legacy `shopify_access_token` column (`src/lib/integrations/my-supabase/types.ts`, `stores` Row) | **High** | Apply the drafted, reviewed RLS migration before any real seller onboards. Move the pickup address, GPS and contact fields out of a world-readable table or column-restrict them. Drop the legacy `stores.shopify_access_token` column after confirming it is null | S–M |
| 2 | Full-body photos and body metrics publicly reachable, and not deleted | `src/routes/find-your-fit.tsx:786-797` uploads to the `avatars` bucket at `${userId}/body-photo.${ext}` and stores `getPublicUrl()`. `fit_profiles` also stores `height_cm`, `weight_kg`, `measurements_cm`. `src/routes/api.account.delete.ts` header says storage objects are left behind | **High** | Private bucket plus short-lived signed URLs. Explicit, separate consent for the photo. Delete storage and Bunny objects on account deletion. Do a DPIA (GAID) since minors are likely | M |
| 3 | Misleading advertising | `src/routes/index.tsx:34,40,138,296,779,931-937,1005-1011` (escrow, "No exceptions" guarantee, "vetted", "DISPUTE COVERED", "authentic pieces"); `QUOTES` testimonials and "★★★★★ Loved by our early shoppers" (lines 120-133, 860-889); `set-up-store.tsx:32` "vetted seller". Payments are not wired (POSTPONED.md §1.5) and no vetting or dispute code exists | **High** | Remove or rewrite as "coming" until built. Delete testimonials and star lines unless they are real, attributable people who consented | S |
| 4 | No age gate; children's data | No DOB or age question anywhere (`grep` across `src/`). `terms.tsx` §3 and `privacy.tsx` §6 are placeholders. NDPA s.31 and the Child's Rights Act define a child as under 18 | **High** | Add an age question at signup. Set 18+ for selling, buying and payouts (also a contract-capacity issue). Decide with counsel whether 13–17 may browse or post, and if so with what parental consent and which features off (fit profile, DMs). Block under-13 outright (COPPA, NDPA s.31(5)) | M |
| 5 | No report, block or moderation | `src/components/messages/ChatHeader.tsx:108-116` and `ReactionBar.tsx:79-85` Report buttons do nothing. No block feature. `src/lib/style-options.ts:56` notes "needs real moderation, which doesn't exist yet". Posts accept any image or video (`src/routes/api.posts.ts`) | **High** | Build report (post, user, product, message) → a `reports` table → a staff queue with a 24h SLA, plus block user, plus basic image screening. Publish Community Guidelines | M–L |
| 6 | Legal and contracting entity | Footer "© 2026 Oakmonte Collective" (`terms.tsx`, `privacy.tsx`); "The business isn't a registered entity" (`Claude outputs/5ed3ad32-...md`); Apple account under an Individual (POSTPONED.md §2.7) | **High** | Incorporate with CAC (Ltd) before taking money. Name the company, RC number and registered address in the Terms and Privacy Policy. Then move Paystack to a Registered Business and Apple to an Organization | L |
| 7 | Holding funds "in escrow" | `terms.tsx` §9: "Funds are collected ... and held by Oakmonte"; `[confirm actual regulatory status]` placeholder. `src/lib/pricing-fees.ts` computes a 4.5% commission | **High** | Don't hold funds yourself. Use Paystack split payments or subaccounts with delayed settlement, or a CBN-licensed escrow provider. Describe the flow in the Terms as the processor's service. Get a lawyer's view on CBN licensing | M–L |
| 8 | Terms and Privacy published with placeholders; weak acceptance | 13+ visible `[Placeholder]` blocks across both pages. Acceptance is "By continuing, you agree to our Terms" (`src/components/onboarding/AuthPanel.tsx:663-669`). No seller agreement, and no version recorded | **High** | Fill every placeholder with counsel. Add a clickwrap checkbox (seller signup at minimum) and store `terms_version` + `accepted_at` per user. Write a separate Seller Agreement | M |
| 9 | NDPC registration, DPO, CAR | Oakmonte will pass 200 data subjects in 6 months quickly. "Public social media app developers" are listed as **UHL** in the NDPC registration notice | **Med-High** | After incorporation: register with the NDPC, appoint a DPO, keep a Record of Processing Activities (ROPA), file the first CAR within 15 months, and set up a 72h breach playbook | M |
| 10 | Refunds and returns | `terms.tsx` §5 `[define return window...]`. The landing FAQ promises "until the customer confirms they're satisfied". FCCPA ss.120, 122, 129 make "no refund" terms unenforceable for defective or misdescribed goods | **Med** (High at payments go-live) | Publish a Refund & Returns Policy consistent with the FCCPA. Set a seller-level minimum standard in the Seller Agreement. Build the dispute flow before claiming it | M |
| 11 | Account deletion gaps (store rejection) | `api.account.delete.ts` doesn't delete storage or Bunny media, doesn't revoke Sign in with Apple tokens, and doesn't touch `support_messages` or `fit_profiles` explicitly. No public web deletion URL for Google Play. No Meta data-deletion callback. No Shopify compliance webhooks (`grep redact` finds nothing) | **Med** | Call Apple `/auth/revoke`. Delete bucket and Bunny objects. Add a `/delete-account` web page for Play. Add a Meta data-deletion callback and Shopify `customers/data_request`, `customers/redact` and `shop/redact` handlers | M |
| 12 | Music: ShareAlike and attribution details | `src/lib/sound-library.ts:143` permits CC BY-SA. The video editor welds audio into the MP4 (POSTPONED.md §0.2). The feed credit has no licence link and no "modified" note. Jamendo API commercial terms are unresolved. `api.posts.ts` still accepts raw `audio` bytes | **Med** | Exclude BY-SA from the video path (or all paths). Add a tap-through credit with the licence URL, source URL and "trimmed". Get written confirmation from Jamendo. Close the raw-audio POST path. Add a copyright takedown address | S–M |
| 13 | Counterfeits and trademarks | A fashion marketplace with Shopify, Bumpa and Instagram bulk import (`api.import.start.ts`). No prohibited-items policy, no brand-owner reporting, and an "authentic pieces" claim on the landing page | **Med** | Prohibited & Restricted Items policy, counterfeit ban and warranties in the Seller Agreement, IP report form, repeat-infringer policy, and remove the "authentic" guarantee | S–M |
| 14 | Undisclosed processors and cross-border transfer | Supabase, Vercel, Bunny CDN (`cdn.oakmonte.net`), Google Fonts (`src/routes/__root.tsx:192-202`), OpenStreetMap Nominatim (`src/components/store/LocationSheet.tsx:68`, which sends exact lat/lng from the browser), Shipbubble, Paystack, Wikimedia, ccMixter, Jamendo. `privacy.tsx` §10–11 are generic placeholders | **Med** | List every processor, its country and its transfer basis (NDPA ss.41–43). Sign DPAs. Self-host fonts. Proxy and cache Nominatim server-side and show "© OpenStreetMap contributors" | S–M |
| 15 | Creator and influencer ads | Creators are paid for sales they drive (`terms.tsx` §7, landing FAQ). ARCON requires pre-exposure approval for ads aimed at Nigerians, and paid posts must be disclosed | **Med** | "Paid partnership" label on posts linked to a commissioning seller. ARCON language in the Creator terms. Get counsel's view on whether marketplace product posts need ARCON vetting | S–M |
| 16 | Security posture for bank details | `store_payout_accounts` holds bank account numbers. No 2FA (POSTPONED.md §2.6). Leaked-password protection, password rules and OTP rate limits are off (POSTPONED.md §1.4). Session in localStorage (§3.6) | **Med** | Set the three Supabase dashboard settings now. Require TOTP or a passkey for sellers before payouts. Add a security page to the Privacy Policy that matches reality | S |
| 17 | Location metadata in uploaded photos | `src/routes/api.products.upload-image.ts` and `api.store-theme.upload-image.ts` pass the raw file to Bunny with no re-encode or EXIF strip | **Low-Med** | Strip EXIF server-side (or re-encode client-side through canvas) before storing | S |
| 18 | Privacy Policy describes cookies and analytics that don't exist | `privacy.tsx` §5 says cookies are used to "understand how the platform is used" and names an analytics placeholder. Code has no analytics SDK and sets no cookies other than an httpOnly OAuth state cookie (`api.shopify.install.tsx:23`) | **Low-Med** | Rewrite §5 to match reality (localStorage, sessionStorage, IndexedDB, all strictly necessary). No banner needed while that stays true; add a GAID-compliant banner the day any analytics lands | S |
| 19 | ~~Fake demo conversations shown to users~~ **Fixed in the same change as this report: the inbox now seeds only Oakmonte Support and "Me".** | `src/routes/messages.tsx:111` initialises with `SEED_CONVERSATIONS` (`src/lib/messages-seed.ts`, e.g. "Nia from Lagos: That blue jacket is everything") | **Low** | Hide seeds in production or label them clearly as examples | S |
| 20 | App Store: web-wrapper and login rules (note: commit `5c5a17c` "Enable Sign in with Apple" landed after POSTPONED.md was written; confirm it works in production before relying on the rest of this row) | Planned native apps from a webapp (Apple 4.2 minimum functionality). Google sign-in is offered, so Apple 4.8 requires an equivalent private login, and Sign in with Apple is dark and blocked on ID (POSTPONED.md §2.7) | **Med** (for November) | Get Sign in with Apple live before iOS submission. Make sure the iOS build adds native value (camera, push notifications, share) beyond the site | M |
| 21 | Accessibility | `src/components/camera/aftershot/TextPanel.tsx:216` sets `maximum-scale=1, user-scalable=no`. Only 84 `alt=` attributes across the app. Nigeria's Discrimination Against Persons with Disabilities Act 2018; EU EAA (micro-enterprise exemption likely applies) | **Low** | Keep the zoom lock scoped to the text tool and restore it on close. Add alt text and labels. Publish a short accessibility statement | S–M |

---

## 3. Findings by area

### 3.1 Data protection: Nigeria (NDPA 2023 + GAID 2025)

**What applies.** The NDPA applies to Oakmonte as a controller established in Nigeria. The GAID has been in force since **19 Sept 2025**. It fills in the detail: privacy notice contents, lawful-basis records, DPIAs, cookie consent, DPO duties and compliance audit returns ([DLA Piper](https://privacymatters.dlapiper.com/2025/06/nigeria-ndpc-issues-gaid-key-compliance-insights/), [GAID PDF](https://ndpc.gov.ng/wp-content/uploads/2025/07/NDP-ACT-GAID-2025-MARCH-20TH.pdf)).

**Registration and filing.** Processing the data of **more than 200 people in 6 months** makes you a Data Controller of Major Importance (DCMI). The NDPC registration notice lists *"public social media app developers and proprietors"* and payment gateways under **Ultra-High Level (₦250,000)**. More than 1,000 subjects is EHL (₦100k), and more than 200 is OHL (₦10k) ([Andersen](https://ng.andersen.com/ndpc-issues-guidance-notice-on-the-registration-of-data-controllers-and-processors-of-major-importance/), [Lexology](https://www.lexology.com/library/detail.aspx?g=84330fb0-4a3f-4588-8a60-89951306f7e5)). With a feed, follows and DMs, Oakmonte may be classed as UHL rather than OHL. A lawyer should confirm. A DCMI must:
- register with the NDPC
- appoint a **DPO**, who under the GAID must have autonomy and resources and report to management twice a year
- file a **Compliance Audit Return** within 15 months of establishment and annually after that, through a licensed DPCO at UHL and EHL levels ([Manifield](https://manifieldsolicitors.com/the-march-31-audit-filing-data-privacy-deadline-compliance-actions-for-businesses/))

**Penalties.** For a DCMI, the higher of ₦10m or 2% of annual gross revenue. Breach notification to the NDPC is due within **72 hours** (s.40), and affected users must be told immediately if the risk is high ([Securiti](https://securiti.ai/overview-of-nigeria-data-protection-act/), [Lex Mundi](https://www.lexmundi.com/guides/data-privacy-guide/jurisdictions/africa/nigeria/)).

**Where the code creates NDPA exposure:**
- **Security of processing (s.39).** RLS is off on 14 tables (POSTPONED.md §1.1 plus the two `drops` tables). `stores` is the one that matters most for privacy: small Nigerian sellers often run from home, and `pickup_address_line` + `pickup_lat`/`pickup_lng` is a home address with a GPS pin, readable by anyone holding the publishable key shipped in the JS bundle. Integrity is also exposed: anyone can rewrite another seller's prices or stock. The migration is written and reviewed. Applying it is the single highest-value action in this report.
- **Body data and images (s.24 data minimisation, s.28 DPIA, s.31 children).** `find-your-fit.tsx` collects height, weight, gender, body type, measurements and an optional full-body photo. The photo URL is public and predictable: `avatars/<uuid>/body-photo.<ext>`, and `public_profiles` exposes user ids. For a young user base this is the scenario most likely to hurt someone and to make headlines. Also, `api.account.delete.ts` explicitly leaves storage files behind, so "delete my account" does not delete the body photo. That contradicts `privacy.tsx` §7 ("your profile is removed").
- **Transparency (ss.27–28).** The Privacy Policy must name the controller, the DPO contact, the lawful basis per purpose, retention periods, every recipient and the transfers abroad. All of these are placeholders today (see §5).
- **Cross-border transfer (ss.41–43).** Every processor sits outside Nigeria: Supabase, Vercel, Bunny, Google, OSMF/Nominatim (UK), Wikimedia (US), Shipbubble and Paystack. Paystack is Nigerian but owned by Stripe. Document the adequacy or safeguard basis for each (DPAs or SCC-type clauses) and say so in the policy.
- **Data subject rights.** Deletion exists in-app (`src/routes/settings.tsx:471`), which is good. There is no access or export route. A manual "email us" process is acceptable at launch if it is written down with a deadline.

### 3.2 Cookies and similar technologies

What the app actually does (from grepping `document.cookie`, `localStorage`, `sessionStorage` and `indexedDB`):
- **No analytics, pixels or ad SDKs.** No gtag, PostHog, Plausible, Meta Pixel or Sentry in `src/` or `package.json`.
- **Cookies:** only an httpOnly OAuth state cookie on Shopify install (`api.shopify.install.tsx:23`). The Supabase session is in **localStorage** (`src/lib/integrations/my-supabase/client.ts`, POSTPONED.md §3.6).
- **localStorage and sessionStorage:** onboarding state (`src/lib/onboarding-state.ts`), save prefs (`save-prefs.ts`), product draft handoff, active store id (`use-own-store.ts`), installed-app stamp (`installed-app.ts`), video editor session, background uploads. All functional or strictly necessary.
- **Third-party requests that carry the user's IP:** Google Fonts CSS and font files on every page (`__root.tsx:192-202`). Nominatim reverse-geocoding with exact coordinates (`LocationSheet.tsx:68`). Audio previews from Wikimedia, ccMixter and Jamendo hosts in the sound picker. Bunny CDN for all media.

**Consequence.** Under the GAID (accept/reject, no pre-ticked boxes, banner at the top) and EU ePrivacy, **strictly necessary storage needs no consent**. So Oakmonte does **not** need a cookie banner today. It needs an accurate Cookie & Storage notice ([NDPA Toolkit](https://ndprtoolkit.com.ng/blog/gaid-2025-cookie-consent-nigeria-website/), [Kukie.io](https://kukie.io/blog/cookie-consent-nigeria-ndpr-compliance)). The day any analytics is added, a GAID-compliant banner is required *before* it fires.

**Google Fonts** is the one EU-facing trap. LG München (3 O 17493/20, Jan 2022) awarded €100 for sending a visitor's IP to Google through embedded Google Fonts without consent, and it triggered a wave of demand letters in Germany ([The Hacker News](https://thehackernews.com/2022/01/german-court-rules-websites-embedding.html), [ePrivacy Blog](https://blog.eprivacy.eu/?p=1398)). Self-hosting the four core fonts removes the issue and is also a performance win, since CLAUDE.md already treats fonts as a performance concern.

**Nominatim** usage policy: requests must identify the app, results require "© OpenStreetMap contributors" attribution (ODbL), app use should go through your own proxy with caching, and client-side autocomplete is banned ([OSMF policy](https://operations.osmfoundation.org/policies/nominatim/)). The current code calls it straight from the browser and shows no attribution.

### 3.3 GDPR / UK GDPR, CCPA/CPRA

- **GDPR/UK GDPR** reaches a non-EU business that *targets* EU or UK residents, for example by offering delivery, EUR or GBP prices, or marketing there (Art. 3(2)). A Naira-only Nigerian marketplace that is merely *reachable* from the EU is probably outside scope. The diaspora is the grey zone. Say in the Terms that the service is aimed at Nigeria, don't advertise to the EU or UK, and the realistic exposure is just the Google Fonts point above.
- **UK Online Safety Act** has a similar "UK links" test. It becomes relevant only if UK users are a target market.
- **CCPA/CPRA** applies only above $26.625m revenue, or 100k+ California consumers, or 50%+ revenue from selling data ([CPPA](https://www.cppa.ca.gov/regulations/cpi_adjustment.html)). **Not applicable**; noted so no one spends time on it.

### 3.4 Children and minors

- **NDPA:** a child is under 18 (via the Child's Rights Act 2003). Where consent is the lawful basis, **parental consent** is needed, with "appropriate mechanisms to verify age and consent" (s.31). Under-13s cannot consent at all (s.31(5)) ([FPF](https://fpf.org/blog/nigerias-new-data-protection-act-explained/), [Aluko & Oyebode](https://www.aluko-oyebode.com/insights/child-data-protection-in-nigeria/)).
- **COPPA:** applies if Oakmonte has *actual knowledge* of collecting data from US under-13s. The amended rule has been in full force since **22 April 2026** ([Finnegan](https://www.finnegan.com/en/insights/articles/coppas-amended-rule-is-now-in-full-effect-what-operators-need-to-know.html), [Hunton](https://www.hunton.com/privacy-and-information-security-law/ftc-publishes-final-coppa-rule-amendments)). An age gate that turns away under-13s keeps this theoretical.
- **Contract capacity:** contracts with minors are generally voidable under Nigerian law. That matters for sellers (the Seller Agreement), for creators taking commissions, and for payouts to bank accounts. It is one more reason to make selling and payouts **18+**.
- **Cybercrimes Act 2015 (as amended 2024) s.23** criminalises child sexual abuse material. A camera-first app with young users, no moderation and full-body photo upload needs a CSAM response plan: report, preserve, notify the authorities, and never simply delete evidence.
- **App stores:** Apple's age-rating questionnaire and Google's target-audience declaration both require you to state whether the app appeals to children. "Most users are young" should be answered honestly.

**Recommendation for counsel to confirm:** 18+ to buy, sell, get paid or create a fit profile. Either 13–17 view-only or social-only with parental consent, or simply **18+ for everyone at launch**, which is the lowest-effort compliant choice. Block under-13.

### 3.5 Consumer protection: FCCPA 2018

The FCCPA and the FCCPC apply to Oakmonte as the operator, not only to its sellers. Key sections:
- **s.120** cancellation right (subject to a reasonable charge)
- **s.122** return and full refund for defective, unsafe or misdescribed goods
- **s.124** no taking advantage of ignorance or the inability to understand an agreement (relevant for young users and dense terms)
- **s.125** misleading representations
- **s.129** terms that waive FCCPA rights are void

Sources: [Dubawa](https://dubawa.org/no-refund-policy-can-nigerians-return-defective-products-for-reimbursement/), [Lexworth](https://www.lexworthlegal.com/the-legality-of-no-refund-policies-in-commercial-contracts-in-nigeria/), [Law Kernel](https://lawkernel.ng/consumer-rights-in-nigeria-under-the-fccpa-2018/).

How this lands on Oakmonte:
- **The live landing page** (`src/routes/index.tsx`) makes promises the product cannot keep yet: escrow, "No payment reaches any seller without customer satisfaction", "No exceptions", "DISPUTE COVERED", "vetted brands", "authentic pieces", "creators ... tracked automatically". It also shows first-name testimonials (David, Jamal, LISA) and "★★★★★ Loved by our early shoppers" before any shopper could have bought anything. If those quotes are not from real, consenting people, they are fabricated reviews. Your own Terms §8 prohibits exactly that ("manufactured scarcity", fake reviews).
- **"Satisfaction" escrow** is a promise the FCCPA will hold you to. If it is advertised, a buyer who is "not happy" will expect a refund. Decide the real rule (for example, delivery confirmed plus a 48–72h inspection window) and advertise that.
- **Fee pass-through** (`products.pass_fees_to_buyer`, `src/lib/pricing-fees.ts`): show the final price including fees on the listing, not first at checkout (drip pricing reads as misleading under s.125).
- **Drops with countdown timers** (`drops.ends_at`): fine if the timers are real. Don't let sellers reset them (false urgency).

### 3.6 Payments, escrow and payouts

- **Paystack is not wired** (POSTPONED.md §1.5). `store_payout_accounts` stores bank name and account number, always with `status: "pending"` (`src/routes/api.store.payout.ts`).
- **Paystack Starter Business** (no CAC registration) has a ₦2m lifetime collection cap and **no Transfers**, which means no seller payouts ([Paystack support](https://support2.paystack.com/hc/en-us/articles/360009972719-What-is-a-Paystack-Starter-Business), [Paystack blog](https://paystack.com/blog/product/paystack-starter-businesses)). A marketplace cannot run on it. Incorporation is on the critical path.
- **Holding money.** `terms.tsx` §9 says funds are "held by Oakmonte". A PSSP licence does *not* allow holding customer funds ([Legal500](https://www.legal500.com/developments/thought-leadership/types-of-fintech-licenses-required-for-operation-in-nigeria/), [CBN PSPs](https://www.cbn.gov.ng/PaymentsSystem/PSPs.html)), and Oakmonte holds no licence at all. The usual unlicensed-marketplace pattern is Paystack **subaccounts / split payments** with the platform taking its 4.5% and settlement *delayed* rather than held ([Paystack split payments](https://paystack.com/docs/payments/split-payments/)). Paystack limits how long settlement can be held, and a released split cannot be clawed back. The "escrow" wording then has to describe the processor's delayed settlement, not Oakmonte's own custody. Get this drafted by counsel and checked against the Paystack Merchant Service Agreement ([Paystack terms](https://paystack.com/terms)).
- **Chargebacks and refunds after release** must be recoverable from the seller. That belongs in the Seller Agreement (set-off, reserve, clawback).
- **Tax.** Commission income and any VAT or withholding on marketplace services is a question for an accountant, noted only so it isn't forgotten.

### 3.7 Marketplace terms: the seller agreement gap

`terms.tsx` §6 covers sellers in six bullets, two of them placeholders. A marketplace needs a separate **Seller Agreement** (clickwrap at `/set-up-store`) covering:
- the commission (the code already says 4.5%)
- payout timing, reserves, clawback and chargebacks
- the seller as merchant of record
- product warranties and legality (including no counterfeits)
- shipping responsibilities via Shipbubble
- return and refund obligations consistent with the FCCPA
- the IP licence for listing photos
- the licence for imported content (Shopify, Bumpa, Instagram: the seller warrants it has the rights)
- data-sharing duties: the seller becomes an independent controller of buyer delivery data and may use it only to fulfil the order
- KYC/vetting consent (BVN/NIN/CAC if collected)
- suspension and termination
- the no-off-platform-payment rule (already enforced in `src/lib/content-policy.ts`, good)
- indemnity

Creators need a matching **Creator Terms / Payout Policy**: commission, attribution window, ARCON and ad-disclosure duties, and model or likeness releases when a post shows other people.

**Acceptance.** "By continuing, you agree to our Terms" under the auth button (`AuthPanel.tsx:663`) is a weak browsewrap/sign-in-wrap. For the Seller Agreement use an unticked checkbox, and store `accepted_terms_version` and `accepted_at` on the profile. Right now nothing records which version anyone agreed to.

### 3.8 UGC: moderation, report and block (Apple 1.2, Play, NITDA)

- **Apple 1.2:** UGC apps must filter objectionable material, provide a report mechanism with timely responses, let users block abusive users, and publish contact information ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)). App Review expects action within about 24h.
- **Google Play UGC policy:** clear terms, in-app reporting of content *and* users, a block function, and enforcement ([Play UGC](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en)).
- **NITDA Code of Practice for Interactive Computer Service Platforms (2022):** acknowledge complaints and remove unlawful content within 24h of notice, have child-protection measures, and file an annual compliance report ([NITDA Code PDF](https://nitda.gov.ng/wp-content/uploads/2022/10/APPROVED-NITDA-CODE-OF-PRACTIVE-FOR-INTERACTIVE-COMPUTER-SERVICE-PLATFORMS-INTERNET-INTERMEDIARIES-2022-002.pdf), [Infusion Lawyers](https://infusionlawyers.com/nitda-code-of-practice-for-digital-platforms/)).

Current state:
- Posts accept any photo or video (`src/routes/api.posts.ts`). Text is filtered for off-platform contact details and profanity (`src/lib/content-policy.ts`), which is a good start but does not screen images.
- Comments are disabled because no table exists (`src/components/feed/CommentSheet.tsx`). DMs between users are seeded demos. Support chat is real, but its migration has not been applied (POSTPONED.md §0.5).
- **Report** buttons exist but do nothing (`ChatHeader.tsx:108-116`, `ReactionBar.tsx:79-85`). **Block** doesn't exist.

Minimum viable compliance before store submission:
- report on post, profile, product and message → `reports` table → an admin view
- a block list that hides content both ways and prevents messages
- a documented 24h SLA
- Community Guidelines linked from the report sheet
- optional: automated nudity screening on upload, given the young audience

### 3.9 Copyright and music

**The music library has mostly been handled carefully** (POSTPONED.md §0.2):
- device audio upload was removed on purpose
- the licence check is an allowlist (`src/lib/sound-library.ts:126-150`) that rejects NC and ND
- attribution travels with the post (`posts.audio_attribution`, `audio_licence`, `audio_source_url`)
- tracks come from Wikimedia Commons, ccMixter and Jamendo, signed so the proxy can't be abused

Remaining legal issues:
1. **CC BY-SA plus video = ShareAlike on the whole video.** CC 4.0 states that where music is "synched in timed relation with a moving image", Adapted Material is **always** produced ([CC BY-SA 4.0 legal code §1(a)](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en), [CC wiki](https://wiki.creativecommons.org/wiki/4.0/ShareAlike)). A seller's product video welded with a BY-SA track must itself be licensed BY-SA. That clashes with your Terms, the seller's expectations, and any exclusive brand content. *Fix:* allow only CC0, public domain and CC BY in the video editor, or everywhere. Photo posts with a separate audio track are arguably collections rather than adaptations, but excluding BY-SA everywhere is simpler.
2. **Attribution completeness.** CC BY 4.0 §3(a) requires the creator, a licence notice with a URI or link "to the extent reasonably practicable", a link to the source, and an **indication if the work was modified**. Trimming counts. The feed shows a text credit only; POSTPONED.md says there is "no link through to the source page from the feed". *Fix:* a small "Sound info" sheet with the licence link, source link and "edited (trimmed)".
3. **Jamendo API terms.** The free API is framed for non-commercial use, and the terms page 404s (POSTPONED.md). The track licences are fine; the *API* use is the open question. Get written confirmation or a commercial key before launch.
4. **Upstream mislabelling.** Commons' Free Music Archive import and ccMixter remixes can carry wrong licence tags or uncleared samples. You rely on the provider's statement. The Terms should say sounds are provided by third parties under their stated licences, and your takedown process covers the rest.
5. **Raw audio POST path still open** (`api.posts.ts` `audio` field, noted in POSTPONED.md). Close it or restrict it to in-app voiceover.
6. **Notice and takedown (Copyright Act 2022 ss.54–56).** The safe harbour depends on acting expeditiously on notices, notifying the uploader, running the counter-notice procedure, and suspending repeat infringers (s.56) ([Mondaq](https://www.mondaq.com/nigeria/copyright/1456386/liability-of-internet-service-providers-isps-in-nigeria-understanding-the-safe-harbour-provisions), [Trusted Advisors](https://trustedadvisorslaw.com/liability-of-internet-service-providers-isps-in-nigeria-understanding-the-safe-harbour-provisions/)). `terms.tsx` §10's IP contact is `[Placeholder]`. Publish a Copyright & IP Policy with a real `copyright@` address, the notice contents, counter-notice, and the repeat-infringer rule. Add a DMCA-style designated agent only if you target the US.
7. **Imported content.** The Instagram importer pulls the seller's own media (`api.instagram.connect.ts`, scope `instagram_business_basic`). Shopify and Bumpa pull catalogue photos, which are often supplier or brand photography the seller doesn't own. The Seller Agreement warranty plus takedown covers this.

### 3.10 Trademark and counterfeits

A fashion marketplace is a magnet for replicas. Nigerian law criminalises forged or false trade marks (Merchandise Marks Act, Trade Marks Act, Trademark Malpractices Act), and brand owners can go after platforms that ignore notices ([Global Legal Post](https://globallegalpost.com/lawoverborders/anti-counterfeiting-225672922/nigeria-933693779), [Mondaq](https://www.mondaq.com/nigeria/trademark/1552790/trademark-law-in-nigeria-a-guide-to-registration-infringement-and-enforcement)). There is no Nigerian statute giving platforms clear immunity for trademark claims, so knowledge plus inaction is the risk. Needed:
- a Prohibited & Restricted Items policy (counterfeits, "inspired by <Brand>" replicas, brand names in titles for unbranded goods)
- a brand-owner report form
- a repeat-offender rule
- removal of the landing page's "authentic pieces" guarantee unless you actually authenticate

Separately, **register "Oakmonte" as a trade mark** (classes 35, 42 and probably 25) once the company exists. Right now you own no mark to enforce.

### 3.11 App Store and Play requirements the web version should already meet

| Requirement | Status in code | Action |
|---|---|---|
| Apple 5.1.1(v) in-app account deletion | Done (`settings.tsx` → `api.account.delete.ts`) | Also revoke Sign in with Apple tokens via `https://appleid.apple.com/auth/revoke` ([Apple news](https://developer.apple.com/news/?id=12m75xbj), [forum](https://developer.apple.com/forums/thread/708415)). Delete storage and Bunny objects |
| Google Play: deletion *web link* | Missing | Public `/delete-account` page usable without the app ([Play help](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)) |
| Apple 1.2 / Play UGC: filter, report, block | Missing | §3.8 |
| Apple 4.8: equivalent private login when Google sign-in is offered | Sign in with Apple dark, blocked on photo ID (POSTPONED.md §2.7) | Unblock before iOS submission |
| Apple 4.2: minimum functionality (web wrappers) | Risk | Ship native value such as push notifications, native camera and share sheet |
| Privacy nutrition label / Data safety form | Not prepared | Declare: contact info, user content (photos, video, audio), identifiers, location (precise, sellers), body measurements and photos, financial info (bank details), purchases. No tracking |
| Privacy policy URL | Exists, but full of placeholders | §5 |
| Meta: data deletion callback or instructions | Missing | Required for the Instagram importer app review ([App Club guide](https://landing.app-club.org/data-deletion-instructions-facebook)) |
| Shopify compliance webhooks | Missing (`grep redact` finds nothing) | `customers/data_request`, `customers/redact`, `shop/redact` handlers for any public Shopify app |

### 3.12 Shipping (Shipbubble)

`src/routes/api.shipbubble.ping.ts` is only a connectivity check today. Once labels are created, buyer name, phone and address go to Shipbubble and its couriers. Disclose them as recipients and cover loss or damage allocation in the Seller Agreement and Refund Policy. Don't promise "Logistics handled" (landing `FEATURES`) until it is.

### 3.13 Support messages and user messaging

- The support chat (`support_messages`) stores user complaints. It needs a retention period and a note in the Privacy Policy.
- The reply route authenticates "a trusted caller", not an individual staff member (POSTPONED.md §0.5). That is acceptable at launch, but keep an audit log once more than one person answers.
- User-to-user DMs aren't live. When they launch, they need report and block (§3.8), a statement on whether staff can read DMs (they can, via the service role), and retention rules.

### 3.14 Location

Sellers can drop a pin (`navigator.geolocation` in `LocationSheet.tsx:238`). It is stored at full precision in `stores.pickup_lat`/`pickup_lng`, readable by anyone while RLS is off. The Privacy Policy's statement that location is "only accessed when you actively use a 'use current location' feature" is accurate for *collection*, but silent on the fact that the pin is kept and exposed. Store a coarse location for display and keep the precise one private for the courier. Separately, EXIF GPS may ride along in raw product and theme image uploads (§2 row 17).

### 3.15 Advertising and influencer rules (ARCON)

The ARCON Act 2022 requires **pre-exposure approval** of adverts aimed at the Nigerian market. ARCON has said this includes influencers and digital creators, and paid content must be disclosed ([Rest of World](https://restofworld.org/2022/nigerian-influencers-government-approval/), [Mondaq](https://www.mondaq.com/nigeria/social-media/1783774/regulatory-and-compliance-regulations-in-influencer-marketing-and-advertising)). Oakmonte's own marketing (landing page, paid social) and possibly commissioned creator posts are in scope. Add "Paid partnership" labelling for creator posts tied to a commission, and ask counsel how far ARCON vetting reaches into marketplace listings.

### 3.16 Accessibility

There is no Nigerian web-accessibility statute with private enforcement comparable to the US ADA. The Discrimination Against Persons with Disabilities (Prohibition) Act 2018 is general. The EU Accessibility Act (June 2025) covers e-commerce offered to EU consumers but exempts micro-enterprises. The practical risks are app review and reputation, not lawsuits. Quick wins:
- scope the `user-scalable=no` override in `TextPanel.tsx:216` to the text tool only, and make sure it resets
- alt text on product and post images (seller-supplied, with a default)
- labels on icon buttons (there are already 267 `aria-label`s, a good base)
- a one-paragraph accessibility statement

### 3.17 The company itself

- **No registered entity.** Every user contract is with the founders personally, and liability is unlimited. Paystack payouts, NDPC registration, the Apple Organization account and trade mark filing all depend on a CAC-registered company. POSTPONED.md §2.7 notes the Apple conversion is "gated on the LLC existing".
- POSTPONED.md §2.7 also says the Apple account is held "under a parent's Apple ID" and that the migration is "gated on the LLC existing, **not** on anyone's age". **If any founder is under 18, raise it with counsel early.** It affects who can sign the company's contracts, who can be a director (CAMA 2020), and who is the named controller under the NDPA.

---

## 4. Missing documents checklist

| Document | Exists? | Notes |
|---|---|---|
| Terms of Service | Draft with placeholders (`src/routes/terms.tsx`) | Needs the legal entity, age, fees, processor, governing law, liability cap and IP contact |
| Privacy Policy | Draft with placeholders (`src/routes/privacy.tsx`) | Needs to match the actual data map (§5) |
| **Cookie & Storage Notice** | No | Short, accurate: strictly-necessary storage only, third-party requests (Google Fonts until self-hosted, CDN, Nominatim) |
| **Seller Agreement** | No | §3.7; clickwrap at store setup |
| **Creator Terms & Payout Policy** | No (`terms.tsx` §7 links to a placeholder) | Commission, disclosure, likeness releases |
| **Community Guidelines** | No | Required in practice by Apple 1.2 and Play UGC |
| **Copyright & IP Policy (notice and takedown)** | No | Copyright Act 2022 ss.54–56; counterfeit reporting for brand owners |
| **Prohibited & Restricted Items Policy** | No | Counterfeits, replicas, used underwear/swimwear hygiene, etc. |
| **Refund, Returns & Dispute Policy** | No | FCCPA ss.120/122/129; the escrow or settlement release rule |
| **Sound / Music Credits & Licence Notice** | Partial (credit line in the feed) | Licence links, "modified" note, provider terms |
| **Children & Parental Consent Policy** (or 18+ statement) | No | Must match the age gate |
| **Data Retention Schedule** | No | Orders and tax records vs. content vs. support chats vs. body photos |
| **Account & Data Deletion web page** | No | Google Play requirement; also the Meta deletion instructions |
| **Data Processing Agreements** with Supabase, Vercel, Bunny, Paystack, Shipbubble | Unknown | Needed for NDPA transfers |
| **Record of Processing Activities (ROPA)** + **DPIA** (fit profile, minors, location) | No | GAID |
| **Breach Response Plan** (72h) | No | NDPA s.40 |
| **Accessibility Statement** | No | Low priority |
| **Internal: moderation playbook, CSAM escalation, law-enforcement request policy** | No | NITDA Code, Cybercrimes Act |

---

## 5. What the current Terms and Privacy pages get wrong or omit

### `src/routes/terms.tsx` (last updated "July 19, 2026")

1. **Claims that aren't true yet.**
   - "Payments are held in escrow until delivery is confirmed." (plain-language box) Paystack isn't wired, and Oakmonte may not lawfully "hold" funds itself (§3.6).
   - "Phone verification is required at checkout and before publishing a review." (§4) There is no SMS/OTP-to-phone provider in the code, no checkout and no reviews.
   - "Sellers and creators go through an additional vetting step" (§4) and "vetted brands and vendors" (§2). No vetting or KYC flow exists.
2. **"Funds are collected at the point of purchase and held by Oakmonte"** (§9). This is the wording most likely to attract a CBN question. Rephrase around the processor's split or delayed settlement.
3. **Placeholders published live:**
   - minimum age (§3)
   - escrow release rule and refund window (§5)
   - commission, which the code already sets at 4.5% in `pricing-fees.ts` (§6)
   - Creator Payout Policy (§7)
   - processor name, regulatory status and currency (§9)
   - IP takedown contact (§10)
   - liability cap (§12, which itself says "do not publish without legal review")
   - governing law (§13)
   - support email (§15)
4. **No contracting party.** The Terms never say *who* "Oakmonte" is: no company name, RC number or address. The footer says "© 2026 Oakmonte Collective".
5. **"Creators retain ownership ... license ... revocable upon deletion of the content"** (§7). The licence is too narrow. It doesn't cover transcoding, thumbnails, caching on a CDN, Oakmonte's own marketing, or sellers re-using the content. Nor does it cover what happens to posts already shared or linked.
6. **Music is put on the creator** ("Creators are responsible for ensuring they have rights to ... music", §7). But the app only allows music from Oakmonte's own library, so Oakmonte is the party choosing the licence terms. The Terms should describe the library and its licences.
7. **Changes clause** (§14): "Continued use ... constitutes acceptance". Weak for material changes and inconsistent with the Privacy Policy's promise to notify directly. Add notice for material changes.
8. **Missing entirely:**
   - UGC rules and moderation rights
   - report and block
   - a prohibited-items / counterfeit ban
   - a repeat-infringer policy
   - FCCPA consumer rights carve-out (you cannot exclude them, s.129)
   - chargebacks
   - taxes
   - account security and 2FA
   - the Instagram, Shopify and Bumpa import licence
   - ARCON / paid-partnership disclosure
   - indemnity
   - force majeure
   - severability
   - the installed-app sign-out quirk (not legal, but a support expectation)
9. **"Oakmonte is a marketplace facilitator. We are not ... merchant of record"** (§2). Good, and worth keeping. But the landing page's "Our guarantee ... No exceptions" undercuts it. A court will read both.

### `src/routes/privacy.tsx`

1. **"Oakmonte uses cookies and similar technologies to ... understand how the platform is used. Analytics provider: [Placeholder]"** (§5). No analytics exists, and the session is in localStorage, not a cookie. Describe what actually happens.
2. **"We collect ... name, email, and phone number. These are collected specifically for checkout and review verification"** (§2). Wrong on both counts. Email is collected at signup for everyone (`profiles.personal_email` is non-null), and the policy omits most of what is collected:
   - `gender`, `self_description`, `referral_source`
   - the whole **fit profile** (height, weight, measurements, body type, **full-body photo**)
   - style preferences
   - seller business phone, email and **pickup address with GPS**
   - **bank account details**
   - camera **and microphone** (`getUserMedia({ audio: true })`, `src/routes/create.index.tsx:361`)
   - barcode scans
   - Instagram, Shopify and Bumpa tokens and imported data
   - support chat messages
3. **"Location ... Oakmonte does not track your location passively"** (§2). True for collection, but silent on storing the precise pin and on sending coordinates to OpenStreetMap's Nominatim from the browser.
4. **"When you delete your account, your profile is removed and your uploaded content is unpublished"** (§7). The deletion route doesn't remove storage or Bunny files, including the body photo.
5. **"We protect user data using standard industry practices, including ... restricted internal access"** (§9). Not accurate while RLS is off on 14 tables. Fix the RLS rather than the sentence.
6. **"User data is hosted on [Placeholder]" / transfer basis [Placeholder]** (§10). All processors are abroad. Name them, their regions and the NDPA transfer basis.
7. **"Oakmonte relies on third-party infrastructure providers ... If you have a question about a specific vendor, reach out"** (§11). The GAID expects recipients to be listed, not given on request. Name Supabase, Vercel, Bunny, Google Fonts, OpenStreetMap/Nominatim, Wikimedia, ccMixter, Jamendo, Shipbubble, Paystack, Meta, Shopify, Bumpa and Apple/Google sign-in.
8. **"By using Oakmonte, you agree to the practices described here"** (§1). Treats the notice as consent. Under the NDPA, state a **lawful basis per purpose**: contract for orders, legitimate interest for fraud prevention, consent for the fit profile and marketing, legal obligation for tax records.
9. **Minors** (§6): placeholders for both the age and the parental process.
10. **Missing:**
    - controller identity and address
    - DPO contact (placeholder)
    - the right to complain to the **NDPC**
    - the right to object and to data portability (NDPA s.38)
    - automated decision-making (recommendations)
    - retention per category
    - breach notification commitment
    - the fact that sellers receive buyer data as independent controllers
    - the separate storage jar for the installed app

---

## 6. Suggested order of work (soft launch → November stores)

1. **This week (hours):**
   - rewrite the landing claims and remove the testimonials and stars
   - hide the seeded DMs
   - apply the RLS migration
   - make the body-photo bucket private
   - set the three Supabase auth dashboard settings
   - add an age question with an 18+ gate
   - replace the analytics and cookie paragraph with accurate text
   - self-host fonts
2. **Before taking any money:**
   - incorporate
   - Paystack Registered Business with split or subaccount settlement
   - Seller Agreement with clickwrap
   - Refund & Returns Policy
   - Terms and Privacy with every placeholder resolved by counsel
   - NDPC registration and DPO
3. **Before the store submissions:**
   - report, block and moderation queue
   - Community Guidelines and Copyright/IP policy with a working takedown inbox
   - deletion fixes: Apple revoke, storage and Bunny purge, Play web page, Meta callback, Shopify webhooks
   - Sign in with Apple live
   - privacy labels and the Data safety form
   - drop BY-SA from video and add licence links
   - Jamendo confirmation

## 7. Questions to put to the lawyer

1. Is Oakmonte OHL, EHL or UHL under the NDPC notice, and is a DPCO-filed CAR needed in year one?
2. Minimum age: 18+ across the board, or 13/16+ with parental consent? What counts as "appropriate" age verification under s.31?
3. Is "escrow" via Paystack delayed settlement lawful without a CBN licence, and what may the marketing call it?
4. Do creator posts or seller listings require ARCON pre-exposure approval?
5. Is Oakmonte an "ISP" under s.108 of the Copyright Act 2022 for the safe harbour, and what notice format and timelines should the policy adopt?
6. Enforceability of the liability cap and of arbitration clauses against consumers under FCCPA s.129.
7. Does the Cybercrimes Act s.38 data retention duty (traffic and subscriber data) apply to Oakmonte?
8. Founder age and capacity issues for incorporation, directorship and contract signature, if relevant.

---

### Sources

- NDPC GAID 2025: [DLA Piper](https://privacymatters.dlapiper.com/2025/06/nigeria-ndpc-issues-gaid-key-compliance-insights/) · [GAID PDF (NDPC)](https://ndpc.gov.ng/wp-content/uploads/2025/07/NDP-ACT-GAID-2025-MARCH-20TH.pdf) · [Manifield: CAR deadlines](https://manifieldsolicitors.com/the-march-31-audit-filing-data-privacy-deadline-compliance-actions-for-businesses/)
- NDPC registration tiers: [Andersen](https://ng.andersen.com/ndpc-issues-guidance-notice-on-the-registration-of-data-controllers-and-processors-of-major-importance/) · [Lexology](https://www.lexology.com/library/detail.aspx?g=84330fb0-4a3f-4588-8a60-89951306f7e5)
- NDPA text and commentary: [NDPA 2023 (ngCERT)](https://cert.gov.ng/ngcert/resources/Nigeria_Data_Protection_Act_2023.pdf) · [FPF](https://fpf.org/blog/nigerias-new-data-protection-act-explained/) · [Aluko & Oyebode: children](https://www.aluko-oyebode.com/insights/child-data-protection-in-nigeria/) · [Securiti](https://securiti.ai/overview-of-nigeria-data-protection-act/) · [Lex Mundi](https://www.lexmundi.com/guides/data-privacy-guide/jurisdictions/africa/nigeria/)
- GAID cookie consent: [NDPA Toolkit](https://ndprtoolkit.com.ng/blog/gaid-2025-cookie-consent-nigeria-website/) · [Kukie.io](https://kukie.io/blog/cookie-consent-nigeria-ndpr-compliance)
- FCCPA: [Dubawa](https://dubawa.org/no-refund-policy-can-nigerians-return-defective-products-for-reimbursement/) · [Lexworth](https://www.lexworthlegal.com/the-legality-of-no-refund-policies-in-commercial-contracts-in-nigeria/) · [Law Kernel](https://lawkernel.ng/consumer-rights-in-nigeria-under-the-fccpa-2018/)
- Copyright Act 2022: [Mondaq: ISP safe harbour](https://www.mondaq.com/nigeria/copyright/1456386/liability-of-internet-service-providers-isps-in-nigeria-understanding-the-safe-harbour-provisions) · [Trusted Advisors](https://trustedadvisorslaw.com/liability-of-internet-service-providers-isps-in-nigeria-understanding-the-safe-harbour-provisions/)
- Creative Commons: [CC BY-SA 4.0 legal code](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en) · [CC wiki: ShareAlike 4.0](https://wiki.creativecommons.org/wiki/4.0/ShareAlike)
- Trademarks and counterfeits: [Global Legal Post](https://globallegalpost.com/lawoverborders/anti-counterfeiting-225672922/nigeria-933693779) · [Mondaq](https://www.mondaq.com/nigeria/trademark/1552790/trademark-law-in-nigeria-a-guide-to-registration-infringement-and-enforcement)
- Payments: [Paystack Starter Business](https://support2.paystack.com/hc/en-us/articles/360009972719-What-is-a-Paystack-Starter-Business) · [Paystack Starter blog](https://paystack.com/blog/product/paystack-starter-businesses) · [Paystack split payments](https://paystack.com/docs/payments/split-payments/) · [Paystack terms](https://paystack.com/terms) · [Legal500: fintech licences](https://www.legal500.com/developments/thought-leadership/types-of-fintech-licenses-required-for-operation-in-nigeria/) · [CBN PSPs](https://www.cbn.gov.ng/PaymentsSystem/PSPs.html)
- ARCON: [Rest of World](https://restofworld.org/2022/nigerian-influencers-government-approval/) · [Mondaq](https://www.mondaq.com/nigeria/social-media/1783774/regulatory-and-compliance-regulations-in-influencer-marketing-and-advertising)
- NITDA Code of Practice: [NITDA PDF](https://nitda.gov.ng/wp-content/uploads/2022/10/APPROVED-NITDA-CODE-OF-PRACTIVE-FOR-INTERACTIVE-COMPUTER-SERVICE-PLATFORMS-INTERNET-INTERMEDIARIES-2022-002.pdf) · [Infusion Lawyers](https://infusionlawyers.com/nitda-code-of-practice-for-digital-platforms/)
- Google Fonts / GDPR: [The Hacker News](https://thehackernews.com/2022/01/german-court-rules-websites-embedding.html) · [ePrivacy Blog](https://blog.eprivacy.eu/?p=1398)
- COPPA: [Finnegan](https://www.finnegan.com/en/insights/articles/coppas-amended-rule-is-now-in-full-effect-what-operators-need-to-know.html) · [Hunton](https://www.hunton.com/privacy-and-information-security-law/ftc-publishes-final-coppa-rule-amendments)
- CCPA: [CPPA thresholds](https://www.cppa.ca.gov/regulations/cpi_adjustment.html)
- Apple: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Account deletion requirement](https://developer.apple.com/news/?id=12m75xbj) · [Sign in with Apple token revocation](https://developer.apple.com/forums/thread/708415)
- Google Play: [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) · [UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en)
- Meta data deletion: [App Club guide](https://landing.app-club.org/data-deletion-instructions-facebook)
- OpenStreetMap Nominatim: [Usage policy](https://operations.osmfoundation.org/policies/nominatim/)

*Not legal advice. Review with a Nigerian-qualified lawyer before launch.*
