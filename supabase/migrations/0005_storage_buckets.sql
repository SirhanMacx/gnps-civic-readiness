-- Supabase Storage bucket for evidence file uploads.
-- Bucket is private (public=false). Service role bypasses bucket policies; anon clients cannot read.

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;
