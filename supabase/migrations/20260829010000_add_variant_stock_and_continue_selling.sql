alter table public.product_variants
  add column continue_selling_out_of_stock boolean not null default false;

create table public.product_variant_stock (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  location_id uuid not null references public.store_locations(id) on delete cascade,
  quantity integer not null default 0,
  unique (variant_id, location_id)
);
