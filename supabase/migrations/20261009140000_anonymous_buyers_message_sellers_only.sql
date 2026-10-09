-- Anonymous accounts (storefront buyers without a login, see
-- src/lib/buyer-session.ts) may only start a chat with someone who owns a
-- store. Applied 2026-10-09 by Diadem in the SQL editor. Sending needs
-- membership of the conversation, so guarding the start is enough.
create or replace function public.start_direct_conversation(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  key text;
  conv uuid;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if other_user = me then
    return public.start_self_conversation();
  end if;
  if not exists (select 1 from public.profiles where id = other_user) then
    raise exception 'no such user' using errcode = 'P0002';
  end if;

  -- An anonymous buyer can only reach a seller.
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
     and not exists (select 1 from public.stores where owner_id = other_user) then
    raise exception 'anonymous accounts can only message sellers' using errcode = '42501';
  end if;

  key := 'direct:' || least(me, other_user)::text || ':' || greatest(me, other_user)::text;
  insert into public.conversations (kind, pair_key) values ('direct', key)
    on conflict (pair_key) do nothing;
  select id into conv from public.conversations where pair_key = key;

  insert into public.conversation_members (conversation_id, user_id)
    values (conv, me), (conv, other_user)
    on conflict do nothing;
  return conv;
end;
$function$;
