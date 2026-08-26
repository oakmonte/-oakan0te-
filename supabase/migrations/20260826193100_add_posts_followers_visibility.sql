-- The previous migration's posts SELECT policy treated 'followers' visibility
-- as invisible to everyone but the owner, on the assumption there was no
-- follows table to check against. There is one (follower_id, following_id on
-- public.follows) -- it predates the migrations directory, same as profiles,
-- so it didn't turn up in the search that informed that assumption. This
-- replaces the policy to actually enforce the followers tier.
drop policy "Owners see all their own posts, others see published+public" on public.posts;

create policy "Owners see own posts, others see published posts they can view"
  on public.posts
  for select
  using (
    user_id = auth.uid()
    or (
      status = 'published'
      and (
        visibility = 'public'
        or (
          visibility = 'followers'
          and exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid() and f.following_id = posts.user_id
          )
        )
      )
    )
  );

drop policy "Tags visible wherever the parent post is" on public.post_product_tags;

create policy "Tags visible wherever the parent post is"
  on public.post_product_tags
  for select
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_product_tags.post_id
        and (
          p.user_id = auth.uid()
          or (
            p.status = 'published'
            and (
              p.visibility = 'public'
              or (
                p.visibility = 'followers'
                and exists (
                  select 1 from public.follows f
                  where f.follower_id = auth.uid() and f.following_id = p.user_id
                )
              )
            )
          )
        )
    )
  );
