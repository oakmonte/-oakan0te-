-- Order timeline events and the refund trail behind seller declines.
-- Additive only: one new table, no existing table or row is touched.
--
-- Why a log rather than *_at columns on orders: orders.updated_at already dates
-- every terminal status (delivered / declined / cancelled are never written
-- again), so the only time that gets lost is when an order shipped -- once it's
-- delivered, updated_at has moved on. Refunds need a place to say "Paystack
-- took it" or "send this one by hand, because ...". One narrow log covers both,
-- and the app reads it through untypedTable() and falls back cleanly while this
-- file is unapplied (see src/lib/order-events.server.ts).
--
-- Written and read only by server routes with the service role. RLS is on with
-- no policies, so every direct client read or write is denied -- the notes can
-- carry Paystack's error text, which is for Oakmonte, not for buyers.

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null check (kind in (
    'shipped', 'delivered', 'declined', 'cancelled', 'refund_started', 'refund_manual')),
  note text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events(order_id, created_at);

-- Refunds owed by hand are the declined/cancelled orders whose payment is still
-- 'confirmed' (that is what the app shows as "Refund pending"); the
-- refund_manual note says why Paystack didn't do it. Once the money is sent,
-- setting that order_payments row to 'refunded' clears it everywhere.

alter table public.order_events enable row level security; -- no client policy: service role only
