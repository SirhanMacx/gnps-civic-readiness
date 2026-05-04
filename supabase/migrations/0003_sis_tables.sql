-- SIS-side data: course catalog, course enrollments, Regents scores.
-- Phase 1: counselor uploads a CSV from Infinite Campus; rows land in these tables.
-- Phase 2: same tables, populated by a live IC sync job.

create table if not exists public.course_catalog (
  id bigserial primary key,
  course_code text unique not null,
  title text not null,
  counts_for text[] not null default '{}',  -- subset of {'1a','1d','2c'}
  credits numeric(3,1) not null default 1.0,
  scrc_approved boolean not null default false,
  scrc_approved_at timestamptz,
  scrc_approved_by uuid references public.users(id),
  created_at timestamptz not null default now()
);
create index if not exists course_catalog_counts_for_idx on public.course_catalog using gin (counts_for);

do $$ begin
  create type credit_status as enum ('passed', 'failed', 'in_progress');
exception when duplicate_object then null; end $$;

create table if not exists public.course_enrollment (
  id bigserial primary key,
  student_id text not null references public.students(id) on delete cascade,
  course_id bigint not null references public.course_catalog(id),
  school_year text not null,
  term text not null default '',
  final_grade smallint,
  credit_status credit_status not null,
  imported_at timestamptz not null default now(),
  unique (student_id, course_id, school_year, term)
);
create index if not exists course_enrollment_student_idx on public.course_enrollment (student_id);

do $$ begin
  create type regents_exam as enum ('GLOBAL_II', 'US_HISTORY');
exception when duplicate_object then null; end $$;

do $$ begin
  create type proficiency_level as enum ('mastery', 'proficiency', 'safety_net_pass', 'below');
exception when duplicate_object then null; end $$;

create table if not exists public.regents_scores (
  id bigserial primary key,
  student_id text not null references public.students(id) on delete cascade,
  exam_code regents_exam not null,
  score smallint not null check (score between 0 and 100),
  exam_date date not null,
  safety_net_applied boolean not null default false,
  imported_at timestamptz not null default now(),
  unique (student_id, exam_code, exam_date)
);
create index if not exists regents_scores_student_idx on public.regents_scores (student_id);

create or replace function public.regents_proficiency(score smallint, safety_net boolean)
returns proficiency_level language sql immutable as $$
  select case
    when score >= 85 then 'mastery'::proficiency_level
    when score between 65 and 84 then 'proficiency'::proficiency_level
    when safety_net and score between 55 and 64 then 'safety_net_pass'::proficiency_level
    else 'below'::proficiency_level
  end;
$$;

alter table public.course_catalog enable row level security;
alter table public.course_enrollment enable row level security;
alter table public.regents_scores enable row level security;
