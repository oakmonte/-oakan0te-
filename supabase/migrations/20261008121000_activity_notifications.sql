-- Activity notifications: likes, comments and mentions, for the activity centre.
--
-- WRITTEN, NOT APPLIED. Nothing can write this table yet: likes are not
-- persisted anywhere (the feed's like button is React state in PostFeed.tsx,
-- gone on reload) and neither are comments (CommentSheet.tsx shows an honest
-- empty state). There is nothing to notify about until those exist. Apply this
-- alongside the migrations that start persisting likes and comments, then
-- regenerate types and read it with the typed .from("activity_notifications")
-- (or untypedTable() in the meantime -- see my-supabase/untyped.ts).
--
-- What is deliberately NOT here: new followers, order updates and unread
-- chats. /api/activity derives those on each request from follows, orders +
-- order_payments and list_inbox, which already hold the truth. Copying them
-- into a second table would only give the two a way to disagree.
--
-- Additive only: one new table, nothing existing is touched.
--
-- Security: RLS on from the first statement. The recipient can read their own
-- rows; there are NO insert/update/delete policies, so the browser can't write
-- at all (deny by default). Server routes write with the service role, which is
-- what stops one user forging a "liked your post" from someone else.

create table public.activity_notifications (
  id uuid primary key default gen_random_uuid(),
  -- Who sees it.
  recipient_id uuid not null references auth.users(id) on delete cascade,
  -- Who did it. Cascade: a deleted account's likes shouldn't linger as
  -- notifications from nobody.
  actor_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('like', 'comment', 'mention')),
  post_id uuid references public.posts(id) on delete cascade,
  -- No foreign key: there is no comments table yet. Add one when it lands.
  comment_id uuid,
  -- A short preview of a comment or mention. Public text (comments are public),
  -- never a direct-message body -- those are encrypted and never leave the
  -- chat routes.
  excerpt text check (excerpt is null or char_length(excerpt) <= 280),
  created_at timestamptz not null default now(),
  -- Per-row read state, for when "seen" moves server side. Today the activity
  -- centre keeps a per-device last-seen time in localStorage instead
  -- (src/lib/activity.ts), which is all a badge needs while nothing is stored.
  read_at timestamptz,
  -- Liking your own post is not news.
  constraint activity_notifications_not_self check (actor_id <> recipient_id),
  -- Likes and comments are always on a post; a mention may later come from
  -- somewhere else (a bio, a store description).
  constraint activity_notifications_post_required check (kind = 'mention' or post_id is not null)
);

-- The activity centre's one query: newest first for one recipient.
create index activity_notifications_recipient_idx
  on public.activity_notifications (recipient_id, created_at desc);

-- A like is a toggle. Unlike-then-like must not stack a second notification,
-- so the writer upserts against this.
create unique index activity_notifications_like_once_idx
  on public.activity_notifications (recipient_id, actor_id, post_id)
  where kind = 'like';

-- Deleting a post cascades through post_id; this keeps that cascade from
-- scanning the whole table.
create index activity_notifications_post_idx
  on public.activity_notifications (post_id)
  where post_id is not null;

alter table public.activity_notifications enable row level security;

-- (select auth.uid()) rather than bare auth.uid(): evaluated once per query,
-- not once per row (Supabase's performance advisor flags the bare form).
create policy "recipient reads own notifications" on public.activity_notifications
  for select using (recipient_id = (select auth.uid()));
