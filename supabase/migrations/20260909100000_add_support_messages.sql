-- User-to-Oakmonte Labs support thread. Each user's thread is represented by
-- their own rows; support staff can read and reply through a server-side client.
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  sender text not null default 'user' check (sender in ('user', 'support')),
  created_at timestamptz not null default now()
);

create index support_messages_user_id_created_at_idx
  on public.support_messages (user_id, created_at);

create policy "Users can read their support messages"
  on public.support_messages
  for select
  using (user_id = auth.uid());

create policy "Users can send support messages"
  on public.support_messages
  for insert
  with check (user_id = auth.uid() and sender = 'user');

alter publication supabase_realtime add table public.support_messages;