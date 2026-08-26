-- Live-availability check for /choose-username. profiles' SELECT policy is
-- auth.uid() = id, so the browser client can't see whether another row with
-- a given username exists at all — this returns only a boolean (never a row),
-- so it can't become a data leak, just a UX hint. The final check remains the
-- upsert's unique-constraint error on submit; this only shortens the feedback
-- loop while typing. id IS DISTINCT FROM auth.uid() means re-submitting your
-- own current username doesn't falsely report itself as taken.
create or replace function public.is_username_available(check_username text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where personal_username = check_username
      and id is distinct from auth.uid()
  );
$$;

grant execute on function public.is_username_available(text) to authenticated;
