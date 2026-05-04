-- Evidence files: PDFs, Word docs, presentations uploaded as evidence for project-type pathways
-- and the application essay component of the civic-elective pathway.
-- Storage location: Supabase Storage bucket 'evidence' (created in 0005).

do $$ begin
  create type evidence_kind as enum (
    'reflection_essay', 'artifact', 'presentation',
    'supervisor_receipt', 'rubric_scoresheet', 'application_essay'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.evidence_files (
  id bigserial primary key,
  submission_id bigint not null references public.pathway_submissions(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  kind evidence_kind not null,
  domain_tags text[] not null default '{}',  -- subset of knowledge|skills|mindsets|experiences
  uploaded_at timestamptz not null default now(),
  uploaded_by_text text
);
create index if not exists evidence_files_submission_idx on public.evidence_files (submission_id);
create index if not exists evidence_files_kind_idx on public.evidence_files (kind);
create index if not exists evidence_files_domain_tags_idx on public.evidence_files using gin (domain_tags);

alter table public.evidence_files enable row level security;
