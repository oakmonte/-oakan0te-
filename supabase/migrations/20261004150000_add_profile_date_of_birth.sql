-- Date of birth, collected on /choose-username.
--
-- Nullable: every existing account predates the question, and the column is
-- never required of them. Private by construction -- profiles is readable only
-- by its owner (RLS: auth.uid() = id), and the public_profiles view selects an
-- explicit column list that does not include this one. Keep it out of that
-- view.
alter table public.profiles
  add column if not exists date_of_birth date;

alter table public.profiles
  drop constraint if exists profiles_date_of_birth_sane;
alter table public.profiles
  add constraint profiles_date_of_birth_sane
  check (date_of_birth is null or (date_of_birth >= date '1900-01-01' and date_of_birth <= current_date));
