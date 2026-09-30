-- Step 2 of 2 for app-level encryption (POSTPONED.md §1.5). Apply only AFTER
-- the encrypting code is deployed AND scripts/encrypt-existing-secrets.ts
-- --write has run clean.
--
-- Refuses plaintext in every encrypted column from here on. These are full
-- (validated) checks, so applying this is also the proof the backfill is
-- complete: if any plaintext row is left — say an old cached PWA wrote a
-- support message after the backfill ran — it fails with 23514 naming the
-- constraint. Re-run the backfill and apply again.
--
-- It also stops that old PWA bundle, which still writes support bodies
-- straight to the table, from storing plaintext once this is in: its sends
-- fail until it updates.

do $$
begin
  if to_regclass('public.messages') is not null then
    alter table public.messages
      add constraint messages_body_encrypted
      check (body is null or body like 'enc:v1:%');
  end if;

  if to_regclass('public.support_messages') is not null then
    alter table public.support_messages
      add constraint support_messages_body_encrypted
      check (body like 'enc:v1:%');
  end if;
end;
$$;

alter table public.store_payout_accounts
  add constraint store_payout_accounts_account_number_encrypted
  check (account_number like 'enc:v1:%');

alter table public.store_credentials
  add constraint store_credentials_shopify_access_token_encrypted
  check (shopify_access_token is null or shopify_access_token like 'enc:v1:%'),
  add constraint store_credentials_bumpa_api_key_encrypted
  check (bumpa_api_key is null or bumpa_api_key like 'enc:v1:%'),
  add constraint store_credentials_instagram_access_token_encrypted
  check (instagram_access_token is null or instagram_access_token like 'enc:v1:%');

comment on column public.store_payout_accounts.account_number is
  'Encrypted by the app (enc:v1:..., AES-256-GCM, bound to store_id). Decrypt only through field-encryption.server.ts with fieldContext.payoutAccountNumber.';
comment on column public.store_credentials.shopify_access_token is
  'Encrypted by the app (enc:v1:...). Decrypt with fieldContext.shopifyAccessToken(store_id).';
comment on column public.store_credentials.bumpa_api_key is
  'Encrypted by the app (enc:v1:...). Decrypt with fieldContext.bumpaApiKey(store_id).';
comment on column public.store_credentials.instagram_access_token is
  'Encrypted by the app (enc:v1:...). Decrypt with fieldContext.instagramAccessToken(store_id).';
