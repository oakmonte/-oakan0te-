-- Carousel posts: a post becomes an ordered list of media instead of exactly one file.
--
-- EXPAND step (see the migrations section of the supabase-data-access skill).
-- `posts.media_url` / `media_type` / `thumbnail_url` are deliberately kept and
-- keep being written with item 0 — the cover. Every existing reader (the feed,
-- the profile grid, the media pickers, the drafts page) goes on working
-- untouched, and only the surfaces that actually want the whole carousel need
-- to learn about this table. A later CONTRACT migration can drop them once
-- nothing reads them; do not drop them in this one.

create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  -- 0-based. Item 0 is the cover and mirrors the columns still on `posts`.
  position smallint not null,
  media_url text not null,
  media_type text not null,
  -- Poster frame. Videos need one; a photo is its own poster and leaves it null.
  thumbnail_url text,
  created_at timestamptz not null default now(),
  constraint post_media_position_unique unique (post_id, position),
  constraint post_media_position_nonneg check (position >= 0)
);

-- No CHECK on media_type, and that is deliberate rather than forgotten:
-- `posts.media_type` has none either, the value is validated in api.posts.ts
-- where it enters, and a constraint here would make adding a third kind a
-- migration instead of a deploy.

create index if not exists post_media_post_id_position_idx
  on public.post_media (post_id, position);

comment on table public.post_media is
  'Ordered media for a post. One row per carousel item; position 0 is the cover and is mirrored onto posts.media_url for readers that only want one.';

-- Backfill: every post that exists becomes a one-item carousel, so no reader
-- has to special-case "post with no media rows". A no-op on an empty table.
insert into public.post_media (post_id, position, media_url, media_type, thumbnail_url)
select p.id, 0, p.media_url, p.media_type, p.thumbnail_url
from public.posts p
on conflict (post_id, position) do nothing;

-- RLS mirrors post_product_tags exactly: this table is another child of
-- `posts`, so it must be visible in precisely the situations its parent is and
-- writable only by the parent's owner. Note that `posts` HAS RLS enabled —
-- unlike the twelve catalogue tables in POSTPONED.md §1.1, which do not, and
-- which this migration deliberately does not touch.
alter table public.post_media enable row level security;

create policy "Media visible wherever the parent post is"
  on public.post_media
  for select
  using (
    exists (
      select 1
      from public.posts p
      where p.id = post_media.post_id
        and (
          p.user_id = auth.uid()
          or (
            p.status = 'published'
            and (
              p.visibility = 'public'
              or (
                p.visibility = 'followers'
                and exists (
                  select 1
                  from public.follows f
                  where f.follower_id = auth.uid()
                    and f.following_id = p.user_id
                )
              )
            )
          )
        )
    )
  );

create policy "Post owners manage their own media"
  on public.post_media
  for all
  using (
    exists (
      select 1
      from public.posts p
      where p.id = post_media.post_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.posts p
      where p.id = post_media.post_id
        and p.user_id = auth.uid()
    )
  );
