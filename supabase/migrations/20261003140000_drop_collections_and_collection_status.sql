-- A drop can now hold several collections and several products at once
-- (it used to be one collection XOR a product list). drop_collections is the
-- collection half; drop_products already covers products.
create table if not exists drop_collections (
  drop_id uuid not null references drops(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (drop_id, collection_id)
);

-- Carry the old single-collection drops over. drops.collection_id stays for
-- now (expand/contract) but nothing writes it any more.
insert into drop_collections (drop_id, collection_id)
select id, collection_id from drops where collection_id is not null
on conflict do nothing;

-- Collections get the same Active / Draft switch products have. Drafts stay
-- off the public storefront. Existing collections were all visible, so they
-- start active.
alter table collections
  add column if not exists status text not null default 'active'
  check (status in ('active', 'draft'));
