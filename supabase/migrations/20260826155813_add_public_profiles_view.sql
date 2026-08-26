-- profiles' SELECT policy is auth.uid() = id, so /profile/$username can only
-- ever load the signed-in user's own row today. This view exposes exactly the
-- columns that route already renders publicly (username, display name,
-- avatar, bio) and nothing else -- personal_email, personal_phone, gender and
-- referral_source stay behind the row-scoped policy on the base table.
--
-- Like profile_stats, this is a plain view with no security_invoker option,
-- so (Postgres default) it runs as its owner and therefore reads profiles
-- without going through the caller's RLS -- that bypass is the entire point,
-- not an oversight. Expect the Supabase advisor to flag this as
-- security_definer_view, exactly as it already does for profile_stats; see
-- the "Not a bug" note in POSTPONED.md.
create view public.public_profiles as
select
  id,
  personal_username,
  display_name,
  avatar_url,
  bio
from public.profiles;

grant select on public.public_profiles to anon, authenticated;
