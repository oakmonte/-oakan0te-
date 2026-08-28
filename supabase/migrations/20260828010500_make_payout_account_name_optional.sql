-- The payout form no longer collects account_name (most sellers don't have
-- it memorized, and Paystack verification -- once wired -- will supply the
-- real bank-verified name anyway rather than trusting free text). Existing
-- rows keep whatever was already saved; new saves just won't set it.
alter table public.store_payout_accounts
  alter column account_name drop not null;
