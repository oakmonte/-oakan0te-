-- How an email's account signs in, for AuthPanel's "you already have an
-- account" banner: is_email_registered only said the account exists, so a
-- Google-only seller was told to "sign in with your password" they never made.
--
-- Returns null for an unknown email, else
--   { "has_password": bool, "providers": ["google", "apple", ...] }
-- providers lists the OAuth identities only ("email" is left out: every
-- account that verified a code has one, and it says nothing about a password).
-- has_password reads the stored hash, with the has_password metadata flag that
-- setAccountPassword writes as a fallback.
--
-- Granted to anon like is_email_registered, and the same accepted enumeration
-- trade-off, one step further: it also tells a visitor which provider an
-- account uses. Nothing secret -- no hash, id or address is returned.
create or replace function public.email_sign_in_methods(check_email text)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'has_password',
      coalesce(u.encrypted_password, '') <> ''
      or coalesce(u.raw_user_meta_data ->> 'has_password', '') = 'true',
    'providers',
      coalesce(
        (select jsonb_agg(distinct i.provider)
           from auth.identities i
          where i.user_id = u.id and i.provider <> 'email'),
        '[]'::jsonb
      )
  )
  from auth.users u
  where lower(u.email) = lower(check_email)
  limit 1;
$$;

revoke all on function public.email_sign_in_methods(text) from public;
grant execute on function public.email_sign_in_methods(text) to anon, authenticated;
