-- Store's private pickup/dispatch location: where delivery riders collect
-- items from the seller, and (when the store owner buys something as a
-- buyer) their default delivery destination. Deliberately separate from any
-- future public "based in" display, which should read state/country only.
-- stores has RLS disabled project-wide already (see supabase-data-access
-- skill / POSTPONED.md) -- these columns inherit that same exposure, not a
-- new hole.
alter table public.stores
  add column pickup_address_line text,
  add column pickup_city text,
  add column pickup_state text,
  add column pickup_country text,
  add column pickup_lat double precision,
  add column pickup_lng double precision,
  add column pickup_location_updated_at timestamptz;
