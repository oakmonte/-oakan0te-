-- Where a post's sound came from, and what naming it obliges us to do.
--
-- Sellers can now pick a track from a catalogue rather than only off their own
-- device (POSTPONED 0.2). Catalogue tracks are free to use, but "free" is not
-- "unconditional": a CC BY track is licensed only while the artist is
-- credited, so a post that plays one without a credit is infringing, and the
-- credit has to live with the post rather than with the picker that chose it.
--
-- Three columns rather than one because these answer different questions:
-- `audio_attribution` is what the feed renders, `audio_licence` is what we
-- could be asked to prove, and `audio_source_url` is where a claim gets
-- checked. All three are null for a sound the seller uploaded themselves,
-- which owes nobody anything, and for every row that already exists.
--
-- RLS note: `posts` is one of the tables where row security is still off
-- pre-launch (POSTPONED 1.1). These columns inherit that, deliberately --
-- adding a column is not the change that should quietly turn it on.
alter table public.posts
  add column if not exists audio_attribution text,
  add column if not exists audio_licence text,
  add column if not exists audio_source_url text;

comment on column public.posts.audio_attribution is
  'Credit line to display beside the post, e.g. "Cascade - Hoving ft Laniakea (CC BY 3.0)". Null when the licence requires no attribution (CC0, public domain) or the seller supplied the track themselves.';
comment on column public.posts.audio_licence is
  'Licence the track is used under, as the source states it: "CC BY 3.0", "CC0", "Public domain". Null for seller-supplied audio.';
comment on column public.posts.audio_source_url is
  'Page the track came from, so a credit can be checked and a takedown traced. Null for seller-supplied audio.';
