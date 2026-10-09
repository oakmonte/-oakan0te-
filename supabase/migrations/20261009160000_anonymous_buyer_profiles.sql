-- Every anonymous buyer (storefront visitor without an account, see
-- src/lib/buyer-session.ts) gets a minimal profile row.
--
-- conversation_members.user_id and messages.sender_id both reference
-- profiles(id), so without one an anonymous buyer could join no chat and send
-- no message: their product enquiry failed, and their inbox showed "Couldn't
-- load your chats". The username is customer-<12 hex of their id>: unique, and
-- it can never clash with a real username (real ones can't contain a hyphen;
-- see username-rules.ts). Sellers see the short customer-xxxxxx form.

create or replace function public.create_anonymous_buyer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_anonymous then
    insert into public.profiles (id, personal_username, personal_email)
    values (new.id, 'customer-' || substr(replace(new.id::text, '-', ''), 1, 12), '')
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_anonymous_user_created on auth.users;
create trigger on_anonymous_user_created
  after insert on auth.users
  for each row execute function public.create_anonymous_buyer_profile();

-- Anonymous buyers who signed in before this existed.
insert into public.profiles (id, personal_username, personal_email)
select u.id, 'customer-' || substr(replace(u.id::text, '-', ''), 1, 12), ''
from auth.users u
where u.is_anonymous
  and not exists (select 1 from public.profiles p where p.id = u.id);
