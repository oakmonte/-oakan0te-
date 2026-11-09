-- Staff back-office (/staff/*).
--
-- staff_members is the allowlist every /api/staff/* handler checks, server-side,
-- with the service role. staff_actions is the audit trail of what staff did:
-- support replies, stores created for clients, and every "open as client"
-- sign-in link minted.
--
-- RLS is ON with NO policies, and anon/authenticated have no grants: the
-- browser can neither read who is staff nor forge a row. Only the service role
-- (server handlers) touches these tables. That differs from the store and
-- catalogue tables, whose reads are public -- deliberately.
--
-- Add a staff member (run in the SQL editor, with the person's auth user id):
--   insert into public.staff_members (user_id, role) values ('<uuid>', 'admin');

create table if not exists public.staff_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'support' check (role in ('admin', 'support')),
  added_at timestamptz not null default now()
);

alter table public.staff_members enable row level security;
revoke all on public.staff_members from anon, authenticated;

create table if not exists public.staff_actions (
  id bigint generated always as identity primary key,
  -- No FK: an audit row must outlive the staff account it names.
  staff_id uuid not null,
  action text not null check (char_length(action) <= 64),
  target_user_id uuid,
  target_store_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists staff_actions_created_at_idx
  on public.staff_actions (created_at desc);
create index if not exists staff_actions_target_user_idx
  on public.staff_actions (target_user_id, created_at desc);

alter table public.staff_actions enable row level security;
revoke all on public.staff_actions from anon, authenticated;
