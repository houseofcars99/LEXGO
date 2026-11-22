-- LEXGO SaaS: private documents attached to cases.
-- TEST DATA ONLY. All access is enforced server-side by RLS.
-- Supabase Storage API is required for object upload/download.
-- Supabase documents: https://supabase.com/docs/guides/storage/security/access-control

create table public.case_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  case_id uuid not null,
  file_name text not null check (char_length(btrim(file_name)) between 1 and 180),
  mime_type text not null check (
    mime_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  ),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  status text not null default 'pending' check (status in ('pending','ready')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  storage_path text generated always as (
    organization_id::text || '/' || case_id::text || '/' || id::text
  ) stored,
  foreign key (case_id,organization_id)
    references public.cases(id,organization_id) on delete restrict,
  unique (storage_path)
);

create index case_documents_case_idx
  on public.case_documents(organization_id,case_id,created_at desc);

create or replace function public.case_documents_guard()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if (new.id,new.organization_id,new.case_id,new.file_name,new.mime_type,
      new.size_bytes,new.created_by,new.created_at)
    is distinct from
     (old.id,old.organization_id,old.case_id,old.file_name,old.mime_type,
      old.size_bytes,old.created_by,old.created_at) then
    raise exception 'Document ownership and metadata cannot be changed';
  end if;
  if new.status is distinct from old.status and not
    (old.status='pending' and new.status='ready') then
    raise exception 'Invalid document status transition';
  end if;
  new.updated_at := now();
  return new;
end $$;

revoke execute on function public.case_documents_guard() from public, anon, authenticated;
create trigger case_documents_guard_update
before update on public.case_documents
for each row execute function public.case_documents_guard();

alter table public.case_documents enable row level security;

create policy case_documents_select on public.case_documents
  for select to authenticated
  using (
    public.can_access_case(case_id)
    and (status='ready' or created_by=(select auth.uid()))
  );

create policy case_documents_insert on public.case_documents
  for insert to authenticated
  with check (
    public.can_access_case(case_id)
    and created_by=(select auth.uid())
    and status='pending'
  );

create policy case_documents_complete on public.case_documents
  for update to authenticated
  using (
    created_by=(select auth.uid())
    and public.can_access_case(case_id)
    and status='pending'
  )
  with check (
    created_by=(select auth.uid())
    and public.can_access_case(case_id)
    and status='ready'
  );

revoke all on public.case_documents from anon;
grant select,insert,update on public.case_documents to authenticated;
-- No DELETE RLS policy; no end-user deletion in the first alpha.

-- Private bucket. Supabase documents allow creating bucket configuration by SQL.
-- No direct insert/delete of storage.objects: actual objects are managed by Storage API.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'lexgo-case-documents','lexgo-case-documents',false,5242880,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
);

create policy lexgo_case_documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id='lexgo-case-documents'
    and exists (
      select 1 from public.case_documents d
      where d.storage_path=name
        and d.status='pending'
        and d.created_by=(select auth.uid())
        and public.can_access_case(d.case_id)
    )
  );

create policy lexgo_case_documents_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id='lexgo-case-documents'
    and exists (
      select 1 from public.case_documents d
      where d.storage_path=name
        and d.status='ready'
        and public.can_access_case(d.case_id)
    )
  );

-- No storage.objects UPDATE or DELETE policies: no overwrite, move, or removal.
