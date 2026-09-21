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
alter table public.products
  add column pass_fees_to_buyer boolean not null default false;

comment on column public.products.pass_fees_to_buyer is
  'When true, the seller entered the amount they want to RECEIVE and product_variants.price holds the grossed-up amount the customer is charged (see src/lib/pricing-fees.ts, grossUpForNet). When false, price is what the customer pays and the fees come out of it.';
