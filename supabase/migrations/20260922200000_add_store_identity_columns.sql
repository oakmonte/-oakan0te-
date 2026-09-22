-- Two additive columns on stores, both for the seller dashboard.
--
-- logo_url — the store's own profile picture.
--
-- Today there is no such column. The store logo lives on
-- store_theme_customizations.logo_image_url, keyed (store_id, theme_slug), so
-- it is a property of the STOREFRONT THEME rather than of the store. That is
-- correct for a theme's artwork and wrong for an identity: a seller who
-- switches storefront theme currently changes -- or loses -- the picture that
-- represents them. The dashboard puts that picture at the top of the page next
-- to the brand name, and an identity that changes when you restyle your shop
-- is not an identity.
--
-- Nullable with no backfill, deliberately. Copying each store's current theme
-- logo in would pin one theme's artwork as the store identity for sellers who
-- have customised several, and it would not remove the need for the read-time
-- fallback anyway -- a seller who later changes a theme logo still expects to
-- see it. src/lib/store-logo.ts resolves:
--
--     stores.logo_url
--       ?? store_theme_customizations.logo_image_url for the store's theme
--          (slug defaulting to 'motion', see below)
--       ?? placeholder
--
-- so no existing seller loses the picture they already have, and new uploads
-- land on the store where they belong.
--
-- That 'motion' default is load-bearing and is not a guess: useStoreTheme
-- defaults an unset stores.theme_id to the 'motion' slug on the client and
-- never writes it back, so a seller who never picked a theme still has real
-- customisations saved under that slug.
--
-- onboarded_at — when this store first finished setup.
--
-- /store shows the setup checklist until setup is complete and the dashboard
-- afterwards. That condition is derived live (payout account, a pickup
-- location, a product, a theme), so without this it flips BOTH ways: delete
-- your last product and the dashboard you have been using for weeks reverts to
-- an onboarding checklist. Stamping the first completion makes the transition
-- one-way; a later regression surfaces in the dashboard's own "Needs attention"
-- section, which is what that section is for.
--
-- On the server rather than in localStorage because it is a property of the
-- store, not of a browser -- a seller signing in on a new phone must not be
-- sent back through onboarding they finished months ago.
--
-- DELIBERATELY NOT AN RLS MIGRATION. It adds two columns and nothing else: no
-- policies, no `enable row level security`, no grants. RLS stays off on stores
-- exactly as it is today and is being left to the dedicated pass
-- (POSTPONED.md 1.1). Do not add policies here; add them there.
--
-- Two things that pass MUST account for, both found while writing this and
-- both launch-blocking if the drafted migration is applied as-is:
--
--   1. stores is read by UNAUTHENTICATED viewers -- the public storefront at
--      /store-profile/:username looks a store up by store_username. One
--      owner-scoped SELECT policy and every public storefront 404s.
--   2. stores cannot simply get a public SELECT policy either. RLS is
--      row-level, not column-level, and this table holds shopify_access_token,
--      shopify_scopes, business_email, business_phone and bumpa_store_id. A
--      public SELECT hands every seller's Shopify token to anyone holding the
--      publishable key.
--
--   The shape that works is the one this repo already uses for the same problem
--   on profiles: a public_stores view exposing only the public columns, per
--   20260826155813_add_public_profiles_view.sql. logo_url belongs in that
--   view's column list. store_theme_customizations has the identical exposure
--   via the logo fallback above.
--
-- Safe with the rls_auto_enable() event trigger, which fires on table CREATION.
-- An ALTER TABLE ... ADD COLUMN does not trip it -- see
-- 20260921140000_add_pass_fees_to_buyer.sql.
alter table public.stores
  add column logo_url text,
  add column onboarded_at timestamptz;

comment on column public.stores.logo_url is
  'The store''s own profile picture, independent of storefront theme. Null means fall back to store_theme_customizations.logo_image_url for the store''s selected theme (slug defaulting to ''motion''). Resolve via src/lib/store-logo.ts rather than reading this directly, so the dashboard and the public storefront cannot disagree.';

comment on column public.stores.onboarded_at is
  'When this store first completed setup (payout account, a pickup location, a product, a storefront theme). Latches the /store route onto the dashboard so a later regression -- deleting the last product, say -- surfaces in Needs attention instead of reverting the seller to an onboarding checklist. Never cleared.';
