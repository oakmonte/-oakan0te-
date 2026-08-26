-- User-authored social posts (photo/video from the camera + after-shot editor),
-- published to a profile. Distinct from ig_posts, which is imported Instagram
-- media for the product-catalogue importer, not user-authored content.
--
-- media_url/thumbnail_url point at Bunny Storage (same pull zone the CSV
-- importer already uses, under a posts/ prefix) -- uploaded server-side in
-- api.posts.ts, never straight from the browser, since the Bunny password is
-- a server secret.
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  media_type text not null check (media_type in ('photo', 'video')),
  -- Video's own frame the studio's Cover tool picked; null for photos, where
  -- media_url doubles as its own thumbnail.
  thumbnail_url text,
  caption text,
  location text,
  -- 'followers' is stored but not yet enforced as distinct from 'public' --
  -- there is no follows table in this schema yet. The SELECT policy below
  -- only special-cases 'public' and the owner; a follows table landing later
  -- should tighten this policy, not change the column.
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'only_me')),
  status text not null default 'published' check (status in ('published', 'draft')),
  created_at timestamptz not null default now()
);

create index posts_user_id_created_at_idx on public.posts (user_id, created_at desc);

-- RLS was auto-enabled by the rls_auto_enable() event trigger on create;
-- these are the policies that make it usable rather than deny-all.
--
-- Owners see every row of their own (drafts, any visibility). Everyone else
-- sees only published+public rows -- this is the real access boundary since
-- the profile page reads posts straight from the browser client.
create policy "Owners see all their own posts, others see published+public"
  on public.posts
  for select
  using (user_id = auth.uid() or (status = 'published' and visibility = 'public'));

create policy "Users insert their own posts"
  on public.posts
  for insert
  with check (user_id = auth.uid());

create policy "Users update their own posts"
  on public.posts
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users delete their own posts"
  on public.posts
  for delete
  using (user_id = auth.uid());

-- Shopping tags: which of the poster's own store products a post is tagged
-- with. Many-to-many so a post can carry more than one tag, matching how
-- Instagram/TikTok shopping tags work.
create table public.post_product_tags (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, product_id)
);

create index post_product_tags_post_id_idx on public.post_product_tags (post_id);
create index post_product_tags_product_id_idx on public.post_product_tags (product_id);

-- Readable wherever the parent post is readable -- same rule, applied via a
-- join since visibility/status/user_id live on posts, not here.
create policy "Tags visible wherever the parent post is"
  on public.post_product_tags
  for select
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_product_tags.post_id
        and (p.user_id = auth.uid() or (p.status = 'published' and p.visibility = 'public'))
    )
  );

create policy "Post owners manage their own tags"
  on public.post_product_tags
  for all
  using (
    exists (select 1 from public.posts p where p.id = post_product_tags.post_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.posts p where p.id = post_product_tags.post_id and p.user_id = auth.uid())
  );
