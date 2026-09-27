-- Seller-typed categories ("Clothing › Aso oke robe" in products.product_type),
-- grouped so we can decide which deserve a real spot in src/lib/categories.ts.
-- Service role / dashboard only: security_invoker plus no grants to API roles.
create or replace view public.custom_category_requests
with (security_invoker = true) as
select
  split_part(product_type, ' › ', 1) as parent,
  split_part(product_type, ' › ', 2) as requested_name,
  count(*) as products,
  count(distinct store_id) as stores,
  min(created_at) as first_seen,
  max(created_at) as last_seen
from public.products
where product_type like '% › %'
group by 1, 2
order by stores desc, products desc;

revoke all on public.custom_category_requests from anon, authenticated;
