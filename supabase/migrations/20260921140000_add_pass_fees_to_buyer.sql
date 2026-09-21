-- Whether the seller passes the transaction fees (Oakmonte's 4.5% commission
-- and Paystack's processing fee) on to the customer instead of absorbing them.
--
-- Lives on products, not product_variants, even though price itself is only on
-- variants: this is a pricing *policy*, not a per-SKU attribute. A seller who
-- wants to be paid their asking price wants that for the whole listing, and
-- putting it on the variant would mean one product whose variants disagree
-- about who pays the fee — which is not a state worth being able to represent.
--
-- Defaults to false, which is the behaviour every existing product already
-- has: the stored price is what the customer pays, and the fees come out of it.
-- So this is additive and changes nothing that is already listed.
--
-- DELIBERATELY NOT AN RLS MIGRATION. It adds a column and nothing else: no
-- policies, no `enable row level security`, no grants. RLS stays off on
-- products exactly as it is today, and is being left alone until the dedicated
-- pass a few days before launch (POSTPONED.md 1.1) -- turning it on piecemeal
-- makes every other workstream harder for no benefit before there are real
-- users. Do not add policies here; add them there.
--
-- Safe with the rls_auto_enable() event trigger, which fires on table CREATION
-- (hence disable_rls_tags and friends having to undo it). An ALTER TABLE ... ADD
-- COLUMN does not trip it -- see add_manual_size_to_products.sql, which adds
-- columns to this same table and says nothing about RLS.
alter table public.products
  add column pass_fees_to_buyer boolean not null default false;

comment on column public.products.pass_fees_to_buyer is
  'When true, the seller entered the amount they want to RECEIVE and product_variants.price holds the grossed-up amount the customer is charged (see src/lib/pricing-fees.ts, grossUpForNet). When false, price is what the customer pays and the fees come out of it.';
