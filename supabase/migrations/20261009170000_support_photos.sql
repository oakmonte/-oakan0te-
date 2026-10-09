-- Photos in Oakmonte Support. A support message can now carry one image
-- (stored in the private chat-media bucket under support/<user id>/...), with
-- or without a caption.

alter table public.support_messages add column if not exists media_path text;
alter table public.support_messages add column if not exists media_meta jsonb;

-- A photo may have no caption; text-only messages still need some text.
alter table public.support_messages drop constraint if exists support_messages_body_check;
alter table public.support_messages add constraint support_messages_body_check check (
  char_length(trim(body)) <= 4000
  and (media_path is not null or char_length(trim(body)) >= 1)
);

-- The user's own support photos: they upload and read only their own folder.
-- (chat_media_conversation() returns null for "support/...", so the existing
-- conversation-member policies never match these paths.)
create policy "Support photos: owner uploads" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = 'support'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Support photos: owner reads" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = 'support'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
