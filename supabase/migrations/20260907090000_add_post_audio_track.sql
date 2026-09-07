-- Sound on a post.
--
-- One track per post rather than per carousel item: choosing a sound is a
-- property of the post, and a different song on every slide is not a thing
-- anyone asked for.
--
-- Posts made in the video editor bake their music into the MP4 and leave this
-- null. When it IS set the feed plays this track and mutes the media's own
-- audio, so no post can ever play two things at once.
--
-- RLS note: `posts` is one of the tables where row security is still off
-- pre-launch (POSTPONED §1.1). These columns inherit that, deliberately --
-- adding a column is not the change that should quietly turn it on.
alter table public.posts
  add column if not exists audio_url text,
  add column if not exists audio_name text;

comment on column public.posts.audio_url is
  'Sound chosen for the post. Played instead of the media''s own audio. Null for video-editor posts, which bake their music in.';
comment on column public.posts.audio_name is
  'Display name for audio_url, shown in the feed. Usually the uploaded file name.';
