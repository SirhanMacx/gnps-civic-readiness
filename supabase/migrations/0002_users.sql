-- Phase 1 staff users (counselors, SCRC committee members, admins).
-- Students do NOT log in in Phase 1 — submission is keyed by Student ID + last name + grad year.
-- Phase 2 will add students via SSO; the schema below stays compatible.

do $$ begin
  create type user_role as enum ('counselor', 'scrc_member', 'admin');
exception when duplicate_object then null; end $$;

create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  full_name text not null,
  role user_role not null,
  caseload_filter jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
create index if not exists users_role_idx on public.users (role);
create index if not exists users_email_idx on public.users (email);

-- Backfill: counselor_id foreign key on students now that users table exists
alter table public.students
  add column if not exists counselor_id uuid references public.users(id);
create index if not exists students_counselor_idx on public.students (counselor_id);

alter table public.users enable row level security;
