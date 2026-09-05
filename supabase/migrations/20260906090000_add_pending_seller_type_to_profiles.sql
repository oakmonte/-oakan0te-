-- Closes a resume gap: seller-type's answer only ever lived in localStorage
-- (onboarding-state.ts) until name-your-store finally wrote it to
-- stores.store_type. A seller who answered /where-did-you-hear-about-us
-- (so referral_source is set, and resolvePostAuthRedirect stops sending them
-- back to /seller-type) but abandoned before /name-your-store, then resumed
-- on a different device/browser (or after localStorage was cleared, e.g.
-- Safari private browsing — already a known concern elsewhere in this app),
-- silently lost their seller-type answer: store_type ended up null forever,
-- never asked again. These two columns are the durable, cross-device home
-- for that answer between /seller-type and /name-your-store; name-your-store
-- clears them once it copies the value onto the real stores row.
alter table public.profiles
  add column pending_store_type text,
  add column pending_offers_custom_orders boolean not null default false;
