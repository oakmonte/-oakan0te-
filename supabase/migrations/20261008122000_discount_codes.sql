-- Seller discount codes. Additive only: two new tables, one function, and two
-- new columns on orders. NOT APPLIED -- written for review.
--
-- Same shape as the orders migration: every write goes through a server route
-- running on the service role (api.store.discounts.ts for the seller,
-- api.orders.ts / settlePaystackPayment for redemptions), so RLS is on with
-- select-only policies and no insert/update/delete policy at all. A browser
-- client can read its own store's codes and nothing else.

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  -- Stored already normalised (upper case, no spaces) by normaliseCode in
  -- src/lib/discounts.ts; the check is the same rule as isValidCode there.
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{1,18}[A-Z0-9]$'),
  kind text not null check (kind in ('percent', 'fixed')),
  percent_off integer check (percent_off between 1 and 90),
  amount_off_kobo integer check (amount_off_kobo > 0),
  min_order_kobo integer not null default 0 check (min_order_kobo >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  -- Not capped at usage_limit on purpose: a buyer who already paid the
  -- discounted price is honoured even if a concurrent order took the last use
  -- (see redeem_discount_code below).
  used_count integer not null default 0 check (used_count >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Exactly one of the two amounts, matching the kind. Without this a row
  -- could carry both and the two readers (preview and order) could disagree.
  constraint discount_codes_amount_matches_kind check (
    (kind = 'percent' and percent_off is not null and amount_off_kobo is null)
    or (kind = 'fixed' and amount_off_kobo is not null and percent_off is null)
  ),
  constraint discount_codes_window check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

-- Codes are case-insensitive to buyers, so "save10" and "SAVE10" must not be
-- able to coexist in one store. Codes are stored upper case already; lower()
-- keeps the guarantee even if a row ever arrives some other way.
create unique index discount_codes_store_code_idx
  on public.discount_codes (store_id, lower(code));
create index discount_codes_store_created_idx
  on public.discount_codes (store_id, created_at desc);

create table public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  -- restrict, not cascade: a code that has been used is part of an order's
  -- money trail. api.store.discounts.ts deactivates such a code instead of
  -- deleting it, and this makes the database refuse too.
  discount_id uuid not null references public.discount_codes(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete cascade,
  amount_kobo integer not null check (amount_kobo >= 0),
  created_at timestamptz not null default now()
);
-- One code per order, and one redemption per order: a webhook replay or a
-- second verify must not count the same order twice.
create unique index discount_redemptions_order_idx on public.discount_redemptions (order_id);
create index discount_redemptions_discount_idx on public.discount_redemptions (discount_id);

-- The order keeps its own snapshot of what was taken off and with which code,
-- so editing or deleting a code later never changes a past order's numbers.
alter table public.orders
  add column discount_kobo integer not null default 0 check (discount_kobo >= 0),
  add column discount_code text;
alter table public.orders
  add constraint orders_discount_within_items check (discount_kobo <= items_total_kobo);

alter table public.discount_codes enable row level security;
alter table public.discount_redemptions enable row level security;

create policy "owner reads own discount codes" on public.discount_codes
  for select using (
    exists (select 1 from public.stores s where s.id = store_id and s.owner_id = auth.uid())
  );
create policy "owner reads own discount redemptions" on public.discount_redemptions
  for select using (
    exists (
      select 1 from public.discount_codes d
      join public.stores s on s.id = d.store_id
      where d.id = discount_id and s.owner_id = auth.uid()
    )
  );

-- Records one use of a code against an order and bumps used_count, atomically.
-- PostgREST cannot express `used_count = used_count + 1`, and a read-then-write
-- from the server would let two settlements both read the same count.
--
-- Returns 'redeemed', 'already_redeemed' (this order was counted before: safe
-- to call again), 'limit_reached' (only when p_allow_over_limit is false), or
-- 'not_found'. Settlement after payment should pass p_allow_over_limit => true:
-- the buyer has paid the discounted price, so the use is honoured either way.
create or replace function public.redeem_discount_code(
  p_discount_id uuid,
  p_order_id uuid,
  p_amount_kobo integer,
  p_allow_over_limit boolean default false
) returns text
language plpgsql
set search_path = ''
as $$
declare
  v_limit integer;
  v_used integer;
begin
  if p_amount_kobo is null or p_amount_kobo < 0 then
    raise exception 'redeem_discount_code: amount must be zero or more';
  end if;

  -- Lock the code row so concurrent redemptions of the same code serialise.
  select usage_limit, used_count into v_limit, v_used
    from public.discount_codes
    where id = p_discount_id
    for update;
  if not found then
    return 'not_found';
  end if;

  if exists (select 1 from public.discount_redemptions where order_id = p_order_id) then
    return 'already_redeemed';
  end if;

  if not p_allow_over_limit and v_limit is not null and v_used >= v_limit then
    return 'limit_reached';
  end if;

  insert into public.discount_redemptions (discount_id, order_id, amount_kobo)
    values (p_discount_id, p_order_id, p_amount_kobo);
  update public.discount_codes
    set used_count = used_count + 1, updated_at = now()
    where id = p_discount_id;
  return 'redeemed';
end;
$$;

-- Functions in public are callable through /rest/v1/rpc by anon and
-- authenticated by default. This one moves money-adjacent counters, so only
-- the service role may run it.
revoke all on function public.redeem_discount_code(uuid, uuid, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.redeem_discount_code(uuid, uuid, integer, boolean)
  to service_role;
