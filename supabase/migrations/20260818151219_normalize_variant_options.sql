-- Normalized product options / values / variant links.
--
-- Replaces the flat option1_*/option2_*/option3_* columns on product_variants,
-- which cap a product at 3 options and cannot answer shopper-facing questions
-- like "every product available in Red" without a full scan of every variant.
--
-- EXPAND phase only: nothing is dropped here. The old columns stay populated
-- until the app is switched over and verified, then a second migration removes
-- them.
--
-- NOTE ON RLS: products and product_variants currently have RLS *disabled*, and
-- the browser client writes to them directly. These tables deliberately match
-- that so the app keeps working. That is a pre-launch hole, not a design
-- choice -- enabling RLS here without policies would silently break every
-- write. It needs fixing together with the hardcoded DEV_STORE_ID.

-- ---------------------------------------------------------------- options ---
create table if not exists public.product_options (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name       text not null,
  position   integer not null,
  created_at timestamptz not null default now(),
  constraint product_options_position_uniq unique (product_id, position)
);

-- one "Size" per product, regardless of casing
create unique index if not exists product_options_name_uniq
  on public.product_options (product_id, lower(name));

create index if not exists product_options_product_id_idx
  on public.product_options (product_id);

-- ----------------------------------------------------------------- values ---
create table if not exists public.product_option_values (
  id         uuid primary key default gen_random_uuid(),
  option_id  uuid not null references public.product_options(id) on delete cascade,
  value      text not null,
  position   integer not null,
  created_at timestamptz not null default now(),
  constraint product_option_values_position_uniq unique (option_id, position)
);

create unique index if not exists product_option_values_value_uniq
  on public.product_option_values (option_id, lower(value));

create index if not exists product_option_values_option_id_idx
  on public.product_option_values (option_id);

-- the index that makes storefront filtering cheap
create index if not exists product_option_values_value_idx
  on public.product_option_values (lower(value));

-- ------------------------------------------------------- variant <-> value ---
create table if not exists public.product_variant_options (
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  option_id  uuid not null references public.product_options(id) on delete cascade,
  value_id   uuid not null references public.product_option_values(id) on delete cascade,
  primary key (variant_id, option_id)
);

create index if not exists product_variant_options_variant_id_idx
  on public.product_variant_options (variant_id);
create index if not exists product_variant_options_value_id_idx
  on public.product_variant_options (value_id);
create index if not exists product_variant_options_option_id_idx
  on public.product_variant_options (option_id);

-- Postgres does not index foreign keys automatically and this one was missing,
-- so every "variants of this product" lookup was a sequential scan.
create index if not exists product_variants_product_id_idx
  on public.product_variants (product_id);

-- ---------------------------------------------------------------- backfill ---
-- 1. one product_options row per (product, slot) that has a name
insert into public.product_options (product_id, name, position)
select distinct pv.product_id, btrim(t.n), t.ord
from public.product_variants pv
cross join lateral (values
  (0, pv.option1_name),
  (1, pv.option2_name),
  (2, pv.option3_name)
) as t(ord, n)
where t.n is not null and btrim(t.n) <> ''
on conflict do nothing;

-- 2. distinct values per option, ordered deterministically
insert into public.product_option_values (option_id, value, position)
select option_id, value, (row_number() over (partition by option_id order by value)) - 1
from (
  select distinct po.id as option_id, btrim(t.v) as value
  from public.product_variants pv
  cross join lateral (values
    (0, pv.option1_value),
    (1, pv.option2_value),
    (2, pv.option3_value)
  ) as t(ord, v)
  join public.product_options po
    on po.product_id = pv.product_id and po.position = t.ord
  where t.v is not null and btrim(t.v) <> ''
) s
on conflict do nothing;

-- 3. link each existing variant to the values that compose it
insert into public.product_variant_options (variant_id, option_id, value_id)
select pv.id, po.id, pov.id
from public.product_variants pv
cross join lateral (values
  (0, pv.option1_value),
  (1, pv.option2_value),
  (2, pv.option3_value)
) as t(ord, v)
join public.product_options po
  on po.product_id = pv.product_id and po.position = t.ord
join public.product_option_values pov
  on pov.option_id = po.id and lower(pov.value) = lower(btrim(t.v))
where t.v is not null and btrim(t.v) <> ''
on conflict do nothing;
