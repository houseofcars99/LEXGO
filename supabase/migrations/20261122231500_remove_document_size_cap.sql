-- Remove LEXGO-specific 5 MiB file cap. Supabase global Storage limit still applies.
-- Preserve non-empty file rule and existing allowed MIME types / private bucket.
alter table public.case_documents
  drop constraint case_documents_size_bytes_check;
alter table public.case_documents
  add constraint case_documents_size_bytes_check check (size_bytes >= 1);

update storage.buckets
set file_size_limit = null
where id = 'lexgo-case-documents';

-- Resumable TUS upload may need to look up in-progress objects.
-- Owner can see their own pending object, but nobody else can read it
-- until finalized; ready documents still require case access.
drop policy lexgo_case_documents_storage_select on storage.objects;
create policy lexgo_case_documents_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'lexgo-case-documents'
  and exists (
    select 1 from public.case_documents d
    where d.storage_path = name
      and public.can_access_case(d.case_id)
      and (
        d.status = 'ready'
        or (d.status = 'pending' and d.created_by = (select auth.uid()))
      )
  )
);
