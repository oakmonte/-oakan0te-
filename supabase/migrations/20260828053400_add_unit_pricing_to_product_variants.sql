alter table public.product_variants
  add column charge_sales_tax boolean not null default true,
  add column show_unit_price boolean not null default false,
  add column unit_total_measurement numeric null,
  add column unit_total_unit text null,
  add column unit_base_unit text null;
