-- product_options / product_option_values / product_variant_options were
-- created by 20260818151219_normalize_variant_options.sql, which triggered
-- rls_auto_enable() to flip RLS on for them with zero policies ever added —
-- unlike products/product_variants, which predate that trigger and stayed
-- open. Net effect: the browser client (used for every "Save Product") has
-- had zero access to these three tables, so saving any variant product has
-- been silently failing at the product_options insert. Matching the existing
-- products/product_variants pre-launch pattern (documented in root
-- CLAUDE.md) to unblock it.
alter table public.product_options disable row level security;
alter table public.product_option_values disable row level security;
alter table public.product_variant_options disable row level security;

create table public.product_size_measurements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size_value text not null,
  measurement_key text not null,
  value_cm numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size_value, measurement_key)
);

comment on table public.product_size_measurements is
  'Per-Size-value body measurements (e.g. Size "M" -> sleeve_length 21cm), keyed by category via src/lib/size-chart-config.ts. measurement_key is an open string on purpose, not a checked enum -- new categories add new keys without a migration. RLS disabled, matching products/product_variants/product_options: written by the same unauthenticated browser client in store.products_.new.tsx handleSave().';

alter table public.product_size_measurements disable row level security;
