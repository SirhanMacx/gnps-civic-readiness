-- Row Level Security policies — Phase 1.
-- Service-role key bypasses RLS, so the SvelteKit server (which uses service_role) reads/writes freely.
-- Anonymous + authenticated clients (browser-side) are denied direct access.
-- Phase 2 will add per-row policies for the student portal (each student reads their own record only)
-- and family-visible read policies. Until then we lock everything down.

-- Helper: lock all tables to deny anonymous AND authenticated access by default.
-- Service role still works because it bypasses RLS entirely.

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename in (
        'audit_log', 'students', 'pathway_submissions', 'hours_log',
        'users', 'course_catalog', 'course_enrollment', 'regents_scores', 'evidence_files'
      )
  loop
    execute format('drop policy if exists %I_deny_all on public.%I', t || '_deny', t);
    execute format($f$
      create policy %I on public.%I
        for all to anon, authenticated
        using (false) with check (false)
    $f$, t || '_deny_all', t);
  end loop;
end $$;

-- Storage objects in 'evidence' bucket: service-role-only.
-- Drop any existing public read policy if it exists.
drop policy if exists "evidence_deny_all" on storage.objects;
create policy "evidence_deny_all" on storage.objects
  for all to anon, authenticated
  using (bucket_id != 'evidence' or false)
  with check (bucket_id != 'evidence' or false);
