-- Make Offer: a buyer names a price for one variant, the seller accepts it or
-- counters, the buyer accepts a counter, and checkout charges the agreed price.
--
-- status:  pending   -- the buyer's offer, waiting on the seller
--          countered -- the seller named counter_kobo, waiting on the buyer
--          accepted  -- agreed_kobo is the price; the buyer can check out
--          used      -- paid for (order_id); can't be used again
--
-- Server-only, like payouts: RLS on with no policies, every read and write goes
-- through api.offers.* / api.store.offers.* with the service role, which check
-- who the caller is.
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  buyer_id uuid not null references auth.users (id) on delete cascade,
  list_price_kobo integer not null check (list_price_kobo >= 0),
  amount_kobo integer not null check (amount_kobo > 0),
  counter_kobo integer check (counter_kobo is null or counter_kobo > 0),
  agreed_kobo integer check (agreed_kobo is null or agreed_kobo > 0),
  status text not null default 'pending'
    check (status in ('pending', 'countered', 'accepted', 'used')),
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index offers_store_idx on public.offers (store_id, created_at desc);
create index offers_buyer_idx on public.offers (buyer_id, created_at desc);
create index offers_order_idx on public.offers (order_id) where order_id is not null;

alter table public.offers enable row level security;
