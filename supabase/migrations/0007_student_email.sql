-- Add student email column for the auto-progress-report feature.
-- Filled in lazily as students submit forms; nullable by design.

alter table public.students
  add column if not exists email text;

create index if not exists students_email_idx on public.students (email);

comment on column public.students.email is
  'Student-provided email — used to send the personalized progress report after each submission. Phase 2 student SSO will replace this with the canonical district-issued address.';
