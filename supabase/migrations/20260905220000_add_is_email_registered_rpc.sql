-- Powers the "you already have an account with this email" / "no account
-- found" checks on the onboarding intent pages and /sign-in (AuthPanel.tsx).
-- Deliberately different from is_username_available: this one is granted to
-- anon too, since a visitor typing an email hasn't signed in yet. That's an
-- accepted, explicit product decision (email enumeration is now possible by
-- design here) — see the AuthPanel.tsx comments this migration's callers add.
-- Checks auth.users, not profiles.personal_email: an account that verified a
-- code but never finished /choose-username has an auth.users row with no
-- profiles row yet, and should still read as "already registered".
create or replace function public.is_email_registered(check_email text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(check_email)
  );
$$;

grant execute on function public.is_email_registered(text) to anon, authenticated;
