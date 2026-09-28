-- Read receipts you can turn off, on WhatsApp's terms: with them off, the
-- people you chat with stop seeing when you've read their messages, and you
-- stop seeing when they've read yours. Delivered ticks are unaffected.
--
-- Why this is more than a flag: until now every member could SELECT the
-- other member's conversation_members row, and that row holds last_read_at
-- (the unread-count watermark) next to pin/mute/archive/clear state. Hiding
-- a column isn't enough -- Realtime still sends the other member an UPDATE
-- event every time the row changes, so "an event arrived and nothing I can
-- see changed" would itself say "they just read it". So the row goes
-- private, and what the other member is allowed to see moves into two
-- tables of its own:
--
--   conversation_read_receipts  read watermark, advanced by trigger only
--                               while the reader has receipts on; readable
--                               only while the VIEWER has receipts on too
--                               (reciprocity enforced by RLS, which Realtime
--                               applies per subscriber)
--   conversation_presence       delivered + last active, readable by both
--
-- Neither is client-writable; triggers and touch_messaging_presence fill
-- them. list_inbox becomes SECURITY DEFINER to read them for the caller.
--
-- Expand only: conversation_members.last_delivered_at / last_active_at stay
-- and stay written (a contract migration drops them once no client reads
-- them). They are simply no longer visible to the other member.

-- ---------------------------------------------------------------------------
-- Per-user messaging settings
-- ---------------------------------------------------------------------------

create table public.messaging_settings (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  -- No row means the defaults: receipts on.
  read_receipts boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.messaging_settings enable row level security;

create policy "Users read their own messaging settings"
  on public.messaging_settings for select
  using (user_id = auth.uid());

create policy "Users create their own messaging settings"
  on public.messaging_settings for insert
  with check (user_id = auth.uid());

create policy "Users change their own messaging settings"
  on public.messaging_settings for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.messaging_settings from anon;
revoke delete, truncate, references, trigger on public.messaging_settings from authenticated;

-- Anyone's setting: for the triggers and list_inbox only, never an RPC.
create or replace function public.read_receipts_enabled(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.read_receipts from public.messaging_settings s where s.user_id = uid),
    true
  );
$$;

revoke execute on function public.read_receipts_enabled(uuid) from public, anon, authenticated;

-- The caller's own setting, for the receipts policy below.
create or replace function public.my_read_receipts_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.read_receipts_enabled(auth.uid());
$$;

revoke execute on function public.my_read_receipts_enabled() from public, anon;
grant execute on function public.my_read_receipts_enabled() to authenticated;

-- ---------------------------------------------------------------------------
-- What the other member may see
-- ---------------------------------------------------------------------------

create table public.conversation_read_receipts (
  conversation_id uuid not null,
  user_id uuid not null,
  -- Everything at or before this, this user has read AND agreed to share.
  read_at timestamptz not null default now(),
  primary key (conversation_id, user_id),
  foreign key (conversation_id, user_id)
    references public.conversation_members (conversation_id, user_id) on delete cascade
);

create table public.conversation_presence (
  conversation_id uuid not null,
  user_id uuid not null,
  -- Last time this user's app fetched the inbox: the grey double tick.
  delivered_at timestamptz not null default now(),
  -- Heartbeat while the app is open: "online" / "last seen".
  active_at timestamptz,
  primary key (conversation_id, user_id),
  foreign key (conversation_id, user_id)
    references public.conversation_members (conversation_id, user_id) on delete cascade
);

alter table public.conversation_read_receipts enable row level security;
alter table public.conversation_presence enable row level security;

create policy "Members see read receipts while sharing their own"
  on public.conversation_read_receipts for select
  using (
    public.is_conversation_member(conversation_id)
    and (user_id = auth.uid() or public.my_read_receipts_enabled())
  );

create policy "Members see each other's presence"
  on public.conversation_presence for select
  using (public.is_conversation_member(conversation_id));

-- Read-only from the app: only the SECURITY DEFINER functions below write.
revoke insert, update, delete, truncate, references, trigger
  on public.conversation_read_receipts, public.conversation_presence from anon, authenticated;
revoke select on public.conversation_read_receipts, public.conversation_presence from anon;

insert into public.conversation_read_receipts (conversation_id, user_id, read_at)
  select conversation_id, user_id, least(last_read_at, now()) from public.conversation_members;

insert into public.conversation_presence (conversation_id, user_id, delivered_at, active_at)
  select conversation_id, user_id, last_delivered_at, last_active_at
  from public.conversation_members;

-- ---------------------------------------------------------------------------
-- Keeping them in step with conversation_members
-- ---------------------------------------------------------------------------

create or replace function public.conversation_members_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.conversation_read_receipts (conversation_id, user_id, read_at)
    values (new.conversation_id, new.user_id, least(new.last_read_at, now()))
    on conflict do nothing;
  insert into public.conversation_presence (conversation_id, user_id, delivered_at, active_at)
    values (new.conversation_id, new.user_id, new.last_delivered_at, new.last_active_at)
    on conflict do nothing;
  return new;
end;
$$;

-- The server's clock decides when something was read, not the phone's.
-- markRead sends the browser's new Date(): a clock running ahead would mark
-- messages "read" before they're sent (and the receipt below only ever moves
-- forward), one running behind would leave just-read messages unread. Every
-- advance means "I've read up to now", so it becomes now(). Nothing
-- legitimately rewinds last_read_at ("Mark as unread" is a flag), so no write
-- moves it backwards either.
create or replace function public.conversation_members_clamp_read()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.last_read_at := least(new.last_read_at, now());
  elsif new.last_read_at is distinct from old.last_read_at then
    new.last_read_at := greatest(old.last_read_at, now());
  end if;
  return new;
end;
$$;

-- Runs on every update, whoever makes it (including messages_after_insert's
-- "sending is reading" bump), so no path advances last_read_at without this
-- deciding what the other member gets to see. (Turning receipts back on is
-- handled by messaging_settings_share_on_enable below.)
create or replace function public.conversation_members_share_read()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.last_read_at is distinct from old.last_read_at
    and public.read_receipts_enabled(new.user_id) then
    update public.conversation_read_receipts
      set read_at = greatest(read_at, new.last_read_at)
      where conversation_id = new.conversation_id
        and user_id = new.user_id
        and read_at < new.last_read_at;
  end if;
  return null;
end;
$$;

revoke execute on function public.conversation_members_after_insert() from public, anon, authenticated;
revoke execute on function public.conversation_members_clamp_read() from public, anon, authenticated;
revoke execute on function public.conversation_members_share_read() from public, anon, authenticated;

create trigger conversation_members_after_insert
  after insert on public.conversation_members
  for each row execute function public.conversation_members_after_insert();

create trigger conversation_members_clamp_read
  before insert or update of last_read_at on public.conversation_members
  for each row execute function public.conversation_members_clamp_read();

create trigger conversation_members_share_read
  after update of last_read_at on public.conversation_members
  for each row execute function public.conversation_members_share_read();

-- Turning receipts back on shares, straight away, everything read while they
-- were off. Otherwise the switch could be flipped on just long enough to see
-- everyone else's reads (the policy shows them immediately) and off again
-- without having shared anything -- the one-sided view reciprocity exists to
-- prevent.
create or replace function public.messaging_settings_share_on_enable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.read_receipts and (tg_op = 'INSERT' or not old.read_receipts) then
    update public.conversation_read_receipts r
      set read_at = m.last_read_at
      from public.conversation_members m
      where m.conversation_id = r.conversation_id
        and m.user_id = r.user_id
        and r.user_id = new.user_id
        and r.read_at < m.last_read_at;
  end if;
  return null;
end;
$$;

revoke execute on function public.messaging_settings_share_on_enable() from public, anon, authenticated;

create trigger messaging_settings_share_on_enable
  after insert or update of read_receipts on public.messaging_settings
  for each row execute function public.messaging_settings_share_on_enable();

-- ---------------------------------------------------------------------------
-- conversation_members goes private to its owner
-- ---------------------------------------------------------------------------

-- Every cross-member read already goes through a SECURITY DEFINER function
-- (is_conversation_member, is_conversation_blocked, list_inbox below), so
-- nothing but the browser's own view of the other member's row changes.
drop policy "Members read conversation members" on public.conversation_members;
create policy "Members read their own membership"
  on public.conversation_members for select
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Heartbeat: now also writes presence (which the client can't)
-- ---------------------------------------------------------------------------

create or replace function public.touch_messaging_presence()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.conversation_members
    set last_active_at = now(), last_delivered_at = now()
    where user_id = auth.uid();
  update public.conversation_presence
    set active_at = now(), delivered_at = now()
    where user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- list_inbox: same signature, reading the new tables
-- ---------------------------------------------------------------------------

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
security definer
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
    -- Reciprocal: with your own receipts off you don't see theirs either.
    case when public.read_receipts_enabled(auth.uid()) then receipt.read_at end,
    presence.delivered_at,
    presence.active_at,
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
  -- Only the other member's id: their private columns stay unread.
  left join public.conversation_members other
    on other.conversation_id = c.id and other.user_id <> me.user_id
  left join public.conversation_read_receipts receipt
    on receipt.conversation_id = c.id and receipt.user_id = other.user_id
  left join public.conversation_presence presence
    on presence.conversation_id = c.id and presence.user_id = other.user_id
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
  -- The one scoping clause everything above hangs off, now that RLS doesn't
  -- apply inside this function. auth.uid() is null for anon, which matches
  -- nothing (and anon has no execute grant besides).
  where me.user_id = auth.uid()
    and (lm.id is not null or c.kind = 'self')
  order by c.last_message_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.conversation_read_receipts;
alter publication supabase_realtime add table public.conversation_presence;
