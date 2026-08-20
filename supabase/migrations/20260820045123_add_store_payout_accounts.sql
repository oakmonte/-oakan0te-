create table public.store_payout_accounts (
  store_id uuid primary key references public.stores(id) on delete cascade,
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  status text not null default 'pending' check (status in ('pending', 'verified')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.store_payout_accounts enable row level security;

-- Deliberately zero policies (mirrors store_credentials): the anon/publishable
-- client cannot read or write this table at all. Bank details only move
-- through the service-role key in api.store.payout.ts's server handlers.
-- Paystack isn't connected yet, so status is written and stays "pending" --
-- nothing here is actually verified.
comment on table public.store_payout_accounts is
  'Seller/creator payout bank details. RLS enabled with zero policies (mirrors store_credentials) so the anon/publishable client cannot read or write this table at all -- only the service-role key, used from api.store.payout.ts server handlers, can touch it. Paystack is not connected yet, so status is written and stays "pending"; nothing here is verified.';
