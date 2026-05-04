-- Add 'teacher' role + per-submission attribution to a staff user.
--
-- 'teacher' is the fourth user_role: counselor, scrc_member, admin, teacher.
-- Teachers can use /teacher/push to award civic-readiness points to students
-- directly — useful when a teacher already has the evidence in hand (e.g. a
-- class-wide civic project, a graded research paper, an AP-US-Gov elective).
--
-- pathway_submissions.submitted_by_user_id lets us trace WHICH staff member
-- originated a submission, so the audit log + counselor approval queue can
-- show "Teacher Maue pushed this for 24 students".

-- Postgres rule: ADD VALUE to an enum cannot run inside a transaction with
-- subsequent uses of the new value. So we ALTER TYPE first, then COMMIT, then
-- the next migration files can use 'teacher'. Supabase's migration runner
-- runs each .sql file in its own transaction by default, so this is fine.

alter type user_role add value if not exists 'teacher';

alter table public.pathway_submissions
  add column if not exists submitted_by_user_id uuid references public.users(id) on delete set null;

create index if not exists pathway_submissions_submitted_by_idx
  on public.pathway_submissions (submitted_by_user_id)
  where submitted_by_user_id is not null;

comment on column public.pathway_submissions.submitted_by_user_id is
  'Staff user (typically teacher or counselor) who pushed this submission on behalf of the student. NULL when the student submitted themselves via the public form.';
