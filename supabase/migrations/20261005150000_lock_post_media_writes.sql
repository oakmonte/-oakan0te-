-- Posts and their media are written only by /api/posts (service role), which
-- checks that every photo, video and thumbnail URL is the caller's own upload
-- (isOwnPostMediaUrl, Bunny Stream ownership). RLS let a post's owner write
-- posts / post_media straight from the browser, skipping all of that: point
-- their post at someone else's media, or at an arbitrary URL. No browser code
-- writes these tables (checked 2026-10-05); owners can still DELETE their
-- posts, which cascades to post_media. No triggers or functions write them.
revoke insert, update on public.posts from anon, authenticated;
revoke insert, update, delete on public.post_media from anon, authenticated;

-- Tags stay browser-writable (LinkProductsSheet, product-save), but only for
-- the caller's own product on the caller's own post -- the WITH CHECK used to
-- check the post only, so anyone could tag a competitor's products.
drop policy "Post owners manage their own tags" on public.post_product_tags;
create policy "Post owners manage their own tags"
  on public.post_product_tags for all to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_product_tags.post_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.posts p
      where p.id = post_product_tags.post_id and p.user_id = auth.uid()
    )
    and exists (
      select 1 from public.products pr
      join public.stores s on s.id = pr.store_id
      where pr.id = post_product_tags.product_id and s.owner_id = auth.uid()
    )
  );
