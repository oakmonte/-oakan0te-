-- Orders / checkout / delivery. DRAFT, NOT APPLIED. Apply to a Supabase branch first.
-- All writes go through server routes with the service role; clients only read
-- their own rows, so no insert/update/delete policies are defined (RLS denies them).

-- Seller shipping settings (one row per store).
create table public.store_shipping_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  strategy text not null default 'flat' check (strategy in ('flat', 'location', 'live')),
  flat_rate_kobo integer check (flat_rate_kobo is null or flat_rate_kobo >= 0),
  location_rates jsonb not null default '[]'::jsonb, -- [{state, rate_kobo}]
  local_pickup boolean not null default false,
  default_weight_kg numeric(6,2) not null default 0.5 check (default_weight_kg > 0),
  pickup_location_id uuid references public.store_locations(id) on delete set null,
  shipbubble_sender_address_code bigint, -- cached validated pickup address
  updated_at timestamptz not null default now()
);

-- Buyer addresses validated through Shipbubble.
create table public.buyer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  address_input text not null,
  formatted_address text,
  shipbubble_address_code bigint,
  lat double precision,
  lng double precision,
  state text,
  city text,
  postal_code text,
  created_at timestamptz not null default now()
);
create index buyer_addresses_user_idx on public.buyer_addresses(user_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Null for a guest checkout; a guest finds their order again with guest_token
  -- (the link we give them), never by listing rows.
  buyer_id uuid references auth.users(id),
  guest_email text,
  guest_token uuid not null default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  status text not null default 'awaiting_acceptance' check (status in (
    'awaiting_acceptance', 'awaiting_payment', 'paid', 'shipped',
    'delivered', 'declined', 'cancelled')),
  items_total_kobo integer not null check (items_total_kobo >= 0),
  delivery_fee_kobo integer not null default 0 check (delivery_fee_kobo >= 0),
  platform_fee_kobo integer not null default 0 check (platform_fee_kobo >= 0),
  total_kobo integer not null check (total_kobo >= 0),
  delivery_method text not null default 'courier' check (delivery_method in ('courier', 'flat', 'pickup')),
  ship_to jsonb, -- snapshot of the buyer address
  shipbubble_request_token text,
  courier_service_code text,
  courier_id text,
  courier_name text,
  shipbubble_order_id text,
  tracking_url text,
  decline_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_buyer_idx on public.orders(buyer_id, created_at desc);
create index orders_store_idx on public.orders(store_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid,
  variant_id uuid,
  title text not null,
  variant_label text,
  image_url text,
  unit_price_kobo integer not null check (unit_price_kobo >= 0),
  quantity integer not null check (quantity > 0),
  weight_grams integer
);
create index order_items_order_idx on public.order_items(order_id);

-- Gateway-agnostic: 'transfer' now (manually confirmed), 'paystack' later.
create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method text not null check (method in ('transfer', 'paystack')),
  amount_kobo integer not null check (amount_kobo >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed', 'refunded')),
  reference text,
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index order_payments_order_idx on public.order_payments(order_id);

-- Money Oakmonte owes out: seller proceeds, courier/rider costs. Manual payout ledger.
create table public.payout_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null check (kind in ('seller', 'courier')),
  store_id uuid references public.stores(id),
  amount_kobo integer not null check (amount_kobo >= 0),
  status text not null default 'owed' check (status in ('owed', 'paid')),
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create index payout_ledger_order_idx on public.payout_ledger(order_id);

alter table public.store_shipping_settings enable row level security;
alter table public.buyer_addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_payments enable row level security;
alter table public.payout_ledger enable row level security; -- no client policy: service role only

create policy "owner reads shipping settings" on public.store_shipping_settings
  for select using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "buyer reads own addresses" on public.buyer_addresses
  for select using (user_id = auth.uid());
create policy "buyer reads own orders" on public.orders
  for select using (buyer_id = auth.uid());
create policy "seller reads store orders" on public.orders
  for select using (exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid()));
create policy "read items of visible orders" on public.order_items
  for select using (exists (select 1 from public.orders o where o.id = order_id
    and (o.buyer_id = auth.uid() or exists (select 1 from public.stores s where s.id = o.store_id and s.owner_id = auth.uid()))));
create policy "read payments of visible orders" on public.order_payments
  for select using (exists (select 1 from public.orders o where o.id = order_id
    and (o.buyer_id = auth.uid() or exists (select 1 from public.stores s where s.id = o.store_id and s.owner_id = auth.uid()))));
