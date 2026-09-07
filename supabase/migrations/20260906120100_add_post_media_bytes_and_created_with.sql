-- Two columns the drafts screen needs, both currently faked at read time.
--
-- `media_bytes` — the drafts list shows each draft's size and can sort by it.
-- With no column for it the screen issues a HEAD request per draft to read
-- Content-Length: correct, but one round trip per row on a phone, and the sort
-- can only order what has come back so far. Written once at upload instead.
--
-- `created_with` — tapping a draft reopens it in an editor, and which editor
-- was a guess from media_type: video to the video editor, anything else to the
-- photo editor. Right for everything the app can currently make, wrong the day
-- a second screen produces video. Recording it removes the guess.
--
-- Both nullable on purpose. Rows written before this migration have neither,
-- and the readers keep their existing fallbacks (HEAD request, media_type
-- inference) for exactly those rows rather than showing a draft as 0 bytes or
-- refusing to open it.

alter table public.posts
  add column if not exists media_bytes bigint,
  add column if not exists created_with text;

comment on column public.posts.media_bytes is
  'Total stored bytes across every item of the post''s carousel. Null for rows written before this column existed.';

comment on column public.posts.created_with is
  'Which screen produced this post: camera | photo-editor | video-editor. Drives which editor a draft reopens in. Null for rows written before this column existed.';
