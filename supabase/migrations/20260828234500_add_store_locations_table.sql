create table public.store_locations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  name text not null,
  address_line text,
  address_line2 text,
  city text,
  state text,
  country text,
  postal_code text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);
