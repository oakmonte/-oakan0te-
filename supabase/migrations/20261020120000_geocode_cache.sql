-- "Use my current location" lookups, remembered per ~11 m square so a second
-- tap at the same spot costs no Google call. Server-only: RLS on with no
-- policies, so only the service role (api.shipping.reverse-geocode) touches it.
-- Rows older than 30 days are ignored and overwritten -- Google's terms cap
-- how long a geocoding result may be stored.
create table if not exists public.geocode_cache (
  key text primary key,
  result jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.geocode_cache enable row level security;

revoke all on public.geocode_cache from anon, authenticated;
