-- Person-to-person messaging: 1:1 chats between any two profiles, plus each
-- user's private "Me" notes thread. Oakmonte Support stays on
-- support_messages (20260909100000) and is not modelled here.
--
-- RLS is ON for every table below from the first migration -- unlike stores /
-- products / product_variants (POSTPONED 1.1), nothing here is ever readable
-- or writable outside the conversations the caller belongs to. All access
-- funnels through is_conversation_member(), which is SECURITY DEFINER so the
-- members policy can reference its own table without recursing.
--
-- Writes the browser may do directly are narrowed further with column grants:
-- a member can only touch their own inbox state (read/pinned/muted/...), and a
-- sender can only edit or soft-delete their own message. Creating
-- conversations and members goes exclusively through the start_* RPCs.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'self')),
  -- One row per pair: 'direct:<lower uuid>:<higher uuid>' or 'self:<uuid>'.
  -- The unique constraint is what makes start_direct_conversation idempotent
  -- under two people tapping "Message" on each other at the same moment.
  pair_key text not null unique,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  -- Everything at or before this is read. Drives unread counts and the
  -- other side's blue ticks.
  last_read_at timestamptz not null default now(),
  -- Last time this user's app fetched the inbox -- the grey double tick.
  last_delivered_at timestamptz not null default now(),
  -- Heartbeat while the app is open; "online" / "last seen" for the other
  -- member. Kept per membership rather than on profiles so it is only ever
  -- visible to people you actually chat with.
  last_active_at timestamptz,
  pinned_at timestamptz,
  muted boolean not null default false,
  archived_at timestamptz,
  -- WhatsApp's "Mark as unread": a flag, not a rewound last_read_at, so the
  -- other side's ticks do not go back from blue to grey.
  marked_unread boolean not null default false,
  -- "Clear chat" / "Delete chat": messages at or before this are hidden for
  -- this member only.
  cleared_at timestamptz,
  primary key (conversation_id, user_id)
);

create index conversation_members_user_id_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'image', 'audio')),
  body text check (body is null or char_length(body) <= 4000),
  -- Object path inside the private chat-media bucket: '<conversation_id>/<file>'.
  media_path text,
  -- { width, height } for images; { duration, waveform[] } for voice notes.
  media_meta jsonb,
  reply_to_id uuid references public.messages(id) on delete set null,
  forwarded boolean not null default false,
  edited_at timestamptz,
  -- "Delete for everyone": the row stays (so replies to it still render a
  -- quote) but body and media are wiped by the trigger below.
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_has_content check (
    deleted_at is not null
    or (kind = 'text' and body is not null and char_length(trim(body)) >= 1)
    or (kind <> 'text' and media_path is not null)
  )
);

create index messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at desc);

create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Denormalised so a realtime subscription can filter on it (Realtime
  -- filters take a single column). Filled by trigger, never by the client.
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index message_reactions_conversation_id_idx on public.message_reactions (conversation_id);

-- "Delete for me".
create table public.message_hides (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_id_idx on public.user_blocks (blocked_id);

-- Write-only from the app; staff read these with the service role.
create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 80),
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_hides enable row level security;
alter table public.user_blocks enable row level security;
alter table public.message_reports enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_conversation_member(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv and user_id = auth.uid()
  );
$$;

-- True when either member of a direct conversation has blocked the other.
create or replace function public.is_conversation_blocked(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members me
    join public.conversation_members other
      on other.conversation_id = me.conversation_id and other.user_id <> me.user_id
    join public.user_blocks b
      on (b.blocker_id = me.user_id and b.blocked_id = other.user_id)
      or (b.blocker_id = other.user_id and b.blocked_id = me.user_id)
    where me.conversation_id = conv and me.user_id = auth.uid()
  );
$$;

revoke execute on function public.is_conversation_member(uuid) from public, anon;
revoke execute on function public.is_conversation_blocked(uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid) to authenticated;
grant execute on function public.is_conversation_blocked(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

create policy "Members read their conversations"
  on public.conversations for select
  using (public.is_conversation_member(id));

-- Members see both rows of their conversation (the other side's read and
-- active timestamps are what power ticks and presence).
create policy "Members read conversation members"
  on public.conversation_members for select
  using (public.is_conversation_member(conversation_id));

create policy "Members update their own inbox state"
  on public.conversation_members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Members read messages"
  on public.messages for select
  using (public.is_conversation_member(conversation_id));

create policy "Members send unblocked messages as themselves"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id)
    and not public.is_conversation_blocked(conversation_id)
    and edited_at is null
    and deleted_at is null
  );

create policy "Senders edit or delete their own messages"
  on public.messages for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

create policy "Members read reactions"
  on public.message_reactions for select
  using (public.is_conversation_member(conversation_id));

create policy "Members react as themselves"
  on public.message_reactions for insert
  with check (user_id = auth.uid() and public.is_conversation_member(conversation_id));

create policy "Members change their own reaction"
  on public.message_reactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_conversation_member(conversation_id));

create policy "Members remove their own reaction"
  on public.message_reactions for delete
  using (user_id = auth.uid());

create policy "Users read their own hides"
  on public.message_hides for select
  using (user_id = auth.uid());

create policy "Users hide messages in their conversations"
  on public.message_hides for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_conversation_member(m.conversation_id)
    )
  );

create policy "Users unhide their own hides"
  on public.message_hides for delete
  using (user_id = auth.uid());

-- Only your own blocks are visible: the blocked person is not told.
create policy "Users read their own blocks"
  on public.user_blocks for select
  using (blocker_id = auth.uid());

create policy "Users block as themselves"
  on public.user_blocks for insert
  with check (blocker_id = auth.uid());

create policy "Users unblock their own blocks"
  on public.user_blocks for delete
  using (blocker_id = auth.uid());

create policy "Members report within their conversations"
  on public.message_reports for insert
  with check (reporter_id = auth.uid() and public.is_conversation_member(conversation_id));

-- Column grants: RLS picks the rows, these pick the columns. Without them a
-- member could rewrite the other person's last_read_at through their own row
-- (the policy only pins user_id), or rewrite a message's conversation_id.
revoke insert, update, delete on public.conversations from anon, authenticated;
revoke insert, update, delete on public.conversation_members from anon, authenticated;
grant update (last_read_at, last_delivered_at, last_active_at, pinned_at, muted, archived_at,
  marked_unread, cleared_at) on public.conversation_members to authenticated;

revoke update on public.messages from anon, authenticated;
grant update (body, edited_at, deleted_at) on public.messages to authenticated;

revoke update on public.message_reactions from anon, authenticated;
grant update (emoji) on public.message_reactions to authenticated;

revoke all on public.message_reports from anon;
revoke select, update, delete on public.message_reports from authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- A new message bumps the conversation up the inbox and, like WhatsApp,
-- brings it back out of the archive for the recipient unless they muted it.
create or replace function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members
    set archived_at = null
    where conversation_id = new.conversation_id
      and user_id <> new.sender_id
      and archived_at is not null
      and muted = false;
  -- Sending is reading: your own message never counts as unread for you.
  update public.conversation_members
    set last_read_at = greatest(last_read_at, new.created_at), marked_unread = false
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end;
$$;

create trigger messages_after_insert
  after insert on public.messages
  for each row execute function public.messages_after_insert();

-- Server-side rules for edits and deletes; the column grants above already
-- keep everything else immutable.
create or replace function public.messages_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.deleted_at is not null then
    raise exception 'message already deleted';
  end if;

  if new.deleted_at is not null then
    new.deleted_at := now();
    new.body := null;
    new.media_path := null;
    new.media_meta := null;
    new.edited_at := old.edited_at;
    return new;
  end if;

  if new.body is distinct from old.body then
    if old.kind <> 'text' then
      raise exception 'only text messages can be edited';
    end if;
    if old.created_at < now() - interval '15 minutes' then
      raise exception 'messages can only be edited for 15 minutes';
    end if;
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;

create trigger messages_before_update
  before update on public.messages
  for each row execute function public.messages_before_update();

create or replace function public.message_reactions_set_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select conversation_id into new.conversation_id from public.messages where id = new.message_id;
  return new;
end;
$$;

create trigger message_reactions_set_conversation
  before insert on public.message_reactions
  for each row execute function public.message_reactions_set_conversation();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.start_direct_conversation(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

  key := 'direct:' || least(me, other_user)::text || ':' || greatest(me, other_user)::text;
  insert into public.conversations (kind, pair_key) values ('direct', key)
    on conflict (pair_key) do nothing;
  select id into conv from public.conversations where pair_key = key;

  insert into public.conversation_members (conversation_id, user_id)
    values (conv, me), (conv, other_user)
    on conflict do nothing;
  return conv;
end;
$$;

create or replace function public.start_self_conversation()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  key text;
  conv uuid;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  key := 'self:' || me::text;
  insert into public.conversations (kind, pair_key) values ('self', key)
    on conflict (pair_key) do nothing;
  select id into conv from public.conversations where pair_key = key;
  insert into public.conversation_members (conversation_id, user_id)
    values (conv, me)
    on conflict do nothing;
  return conv;
end;
$$;

-- The inbox in one round trip. SECURITY INVOKER: every table it reads is
-- already row-scoped by the policies above, so it cannot see more than the
-- caller could query by hand.
create or replace function public.list_inbox()
returns table (
  conversation_id uuid,
  kind text,
  last_message_at timestamptz,
  pinned_at timestamptz,
  muted boolean,
  archived_at timestamptz,
  marked_unread boolean,
  last_read_at timestamptz,
  cleared_at timestamptz,
  other_user_id uuid,
  other_username text,
  other_display_name text,
  other_avatar_url text,
  other_last_read_at timestamptz,
  other_last_delivered_at timestamptz,
  other_last_active_at timestamptz,
  blocked_by_me boolean,
  last_message_id uuid,
  last_message_sender_id uuid,
  last_message_kind text,
  last_message_body text,
  last_message_meta jsonb,
  last_message_deleted boolean,
  last_message_created_at timestamptz,
  unread_count integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.kind,
    c.last_message_at,
    me.pinned_at,
    me.muted,
    me.archived_at,
    me.marked_unread,
    me.last_read_at,
    me.cleared_at,
    other.user_id,
    p.personal_username,
    p.display_name,
    p.avatar_url,
    other.last_read_at,
    other.last_delivered_at,
    other.last_active_at,
    exists (
      select 1 from public.user_blocks b
      where b.blocker_id = auth.uid() and b.blocked_id = other.user_id
    ),
    lm.id,
    lm.sender_id,
    lm.kind,
    lm.body,
    lm.media_meta,
    lm.deleted_at is not null,
    lm.created_at,
    coalesce((
      select count(*)::integer
      from public.messages m
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > me.last_read_at
        and m.created_at > coalesce(me.cleared_at, '-infinity')
        and m.deleted_at is null
        and not exists (
          select 1 from public.message_hides h
          where h.message_id = m.id and h.user_id = auth.uid()
        )
    ), 0)
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join public.conversation_members other
    on other.conversation_id = c.id and other.user_id <> me.user_id
  left join public.public_profiles p on p.id = other.user_id
  left join lateral (
    select m.*
    from public.messages m
    where m.conversation_id = c.id
      and m.created_at > coalesce(me.cleared_at, '-infinity')
      and not exists (
        select 1 from public.message_hides h
        where h.message_id = m.id and h.user_id = auth.uid()
      )
    order by m.created_at desc
    limit 1
  ) lm on true
  where me.user_id = auth.uid()
    -- A chat nobody has written in yet (someone opened it and left) stays out
    -- of the inbox, like WhatsApp. "Me" is always listed.
    and (lm.id is not null or c.kind = 'self')
  order by c.last_message_at desc;
$$;

-- Heartbeat: "I'm here, and I've received everything so far."
create or replace function public.touch_messaging_presence()
returns void
language sql
security invoker
set search_path = public
as $$
  update public.conversation_members
    set last_active_at = now(), last_delivered_at = now()
    where user_id = auth.uid();
$$;

revoke execute on function public.start_direct_conversation(uuid) from public, anon;
revoke execute on function public.start_self_conversation() from public, anon;
revoke execute on function public.list_inbox() from public, anon;
revoke execute on function public.touch_messaging_presence() from public, anon;
grant execute on function public.start_direct_conversation(uuid) to authenticated;
grant execute on function public.start_self_conversation() to authenticated;
grant execute on function public.list_inbox() to authenticated;
grant execute on function public.touch_messaging_presence() to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Realtime applies each subscriber's SELECT policy before delivering a change,
-- so subscribing without a filter only ever yields the caller's own rows.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.conversation_members;

-- ---------------------------------------------------------------------------
-- Storage: photos and voice notes
-- ---------------------------------------------------------------------------

-- Private bucket: objects are only reachable through short-lived signed URLs,
-- which storage only issues to members of the conversation in the path.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mp4', 'audio/webm',
    'audio/ogg', 'audio/mpeg', 'audio/aac']
)
on conflict (id) do nothing;

-- The first path segment is the conversation id. Anything that is not a uuid
-- is simply not a member path (rather than a cast error).
create or replace function public.chat_media_conversation(object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(object_name, '/', 1)::uuid
  end;
$$;

create policy "Chat members read chat media"
  on storage.objects for select
  using (
    bucket_id = 'chat-media'
    and public.is_conversation_member(public.chat_media_conversation(name))
  );

create policy "Chat members upload chat media"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-media'
    and public.is_conversation_member(public.chat_media_conversation(name))
    and not public.is_conversation_blocked(public.chat_media_conversation(name))
  );

create policy "Uploaders delete their chat media"
  on storage.objects for delete
  using (bucket_id = 'chat-media' and owner_id = auth.uid()::text);
