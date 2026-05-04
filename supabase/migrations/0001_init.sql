-- GNPS Civic Readiness Portal — Phase 1 EOD slice
-- Minimal schema for service-learning submissions + supervisor confirmation + audit log.
-- Full schema lives in docs/superpowers/specs/2026-05-04-gnps-civic-readiness-portal-design.md §4.
-- Subsequent migrations (0002+) will expand to full Phase 1.

create extension if not exists "uuid-ossp";

-- Audit log — append-only, retained indefinitely while seal records exist.
create table if not exists public.audit_log (
  id bigserial primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_kind text not null,
  action text not null,
  target_type text,
  target_id text,
  ip inet,
  user_agent text,
  data jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_occurred_at_idx on public.audit_log (occurred_at desc);
create index if not exists audit_log_target_idx on public.audit_log (target_type, target_id);
comment on table public.audit_log is 'Append-only. Never UPDATE or DELETE rows. Required for NYSED audit defensibility.';

-- Students — keyed by external SIS id (e.g. GN20271234). Trust-on-first-use in Phase 1.
do $$ begin create type student_status as enum ('active','awarded','withdrawn','graduated_without_seal'); exception when duplicate_object then null; end $$;

create table if not exists public.students (
  id text primary key,
  last_name text not null,
  first_name text not null,
  grad_year smallint not null,
  accommodations_flag boolean not null default false,
  status student_status not null default 'active',
  created_at timestamptz not null default now()
);
create index if not exists students_grad_year_idx on public.students (grad_year);

-- Pathway submissions — central evidence record for non-SIS pathways.
do $$ begin
  create type pathway_type as enum (
    'research_project','hs_civic_project','service_learning',
    'civic_elective_essay','wbl_extracurr','ms_capstone','hs_capstone'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type submission_status as enum (
    'draft','proposed','topic_approved','in_progress','submitted','scored','awarded','rejected','revoked'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.pathway_submissions (
  id bigserial primary key,
  student_id text not null references public.students(id) on delete cascade,
  pathway_type pathway_type not null,
  status submission_status not null default 'draft',
  points_awarded numeric(3,1),
  instance_number smallint not null default 1,
  domain_tags text[] not null default '{}',
  proposed_at timestamptz,
  topic_approved_at timestamptz,
  topic_approved_by uuid,
  submitted_at timestamptz,
  scored_at timestamptz,
  scored_by uuid,
  awarded_at timestamptz,
  proposed_by_text text,
  rubric_scores jsonb not null default '{}'::jsonb,
  notes text,
  proposal_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ps_student_idx on public.pathway_submissions (student_id);
create index if not exists ps_status_idx on public.pathway_submissions (status);
create index if not exists ps_pathway_idx on public.pathway_submissions (pathway_type);

-- Hours log — one or more rows per service_learning / wbl_extracurr submission.
do $$ begin create type service_type as enum ('direct','indirect','advocacy'); exception when duplicate_object then null; end $$;
do $$ begin create type confirmation_status as enum ('pending','confirmed','disputed','expired'); exception when duplicate_object then null; end $$;

create table if not exists public.hours_log (
  id bigserial primary key,
  submission_id bigint not null references public.pathway_submissions(id) on delete cascade,
  activity_name text not null,
  organization text,
  service_type service_type,
  hours numeric(5,1) not null check (hours > 0),
  date_start date not null,
  date_end date not null,
  description text,
  supervisor_name text not null,
  supervisor_email text not null,
  supervisor_org text,
  confirmation_token uuid not null default uuid_generate_v4(),
  confirmation_status confirmation_status not null default 'pending',
  confirmation_sent_at timestamptz,
  confirmation_responded_at timestamptz,
  confirmer_ip inet,
  confirmation_dispute_reason text,
  created_at timestamptz not null default now()
);
create unique index if not exists hours_log_token_idx on public.hours_log (confirmation_token);
create index if not exists hours_log_submission_idx on public.hours_log (submission_id);
create index if not exists hours_log_supervisor_email_idx on public.hours_log (supervisor_email);

-- RLS: lock everything down. Service role bypasses RLS, so the SvelteKit
-- server (which holds SUPABASE_SERVICE_ROLE_KEY) can read/write freely.
-- Anonymous client cannot reach these tables directly.
alter table public.students enable row level security;
alter table public.pathway_submissions enable row level security;
alter table public.hours_log enable row level security;
alter table public.audit_log enable row level security;
