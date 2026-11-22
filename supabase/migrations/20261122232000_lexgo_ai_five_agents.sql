-- LEXGO AI Alpha: five-agent workflow for synthetic legal scenarios.
-- No provider secret in the database or frontend.
-- Each run belongs to an authenticated user AND a case in their organization.
create table public.ai_draft_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  case_id uuid not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  document_type text not null check (document_type in (
    'pozew','odpowiedz_na_pozew','apelacja','zazalenie','wniosek','pismo_procesowe','opinia'
  )),
  instructions text not null check (char_length(btrim(instructions)) between 10 and 3000),
  source_text text not null check (char_length(btrim(source_text)) between 30 and 20000),
  verified_sources text not null default '' check (char_length(verified_sources) <= 4000),
  external_processing_consent boolean not null default false,
  mode text not null default 'premium' check (mode='premium'),
  state text not null default 'draft' check (state in ('draft','running','error','complete')),
  next_stage integer not null default 0 check (next_stage between 0 and 5),
  active_stage integer check (active_stage between 0 and 4),
  responses jsonb not null default '{}'::jsonb check (jsonb_typeof(responses)='object'),
  last_error_code text,
  run_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (case_id,organization_id) references public.cases(id,organization_id) on delete restrict,
  constraint ai_draft_runs_consent_required check (external_processing_consent=true)
);
create index ai_draft_runs_by_owner on public.ai_draft_runs
  (created_by, organization_id, created_at desc);
create index ai_draft_runs_by_case on public.ai_draft_runs (case_id, created_at desc);

-- No client-side modifications of status or results.
alter table public.ai_draft_runs enable row level security;
create policy ai_runs_select on public.ai_draft_runs
  for select to authenticated
  using (
    created_by=(select auth.uid())
    and public.can_access_case(case_id)
  );
create policy ai_runs_insert on public.ai_draft_runs
  for insert to authenticated
  with check (
    created_by=(select auth.uid())
    and public.can_access_case(case_id)
    and state='draft'
    and next_stage=0
    and responses='{}'::jsonb
  );
revoke all on public.ai_draft_runs from anon,authenticated;
grant select,insert on public.ai_draft_runs to authenticated;
-- UPDATE and DELETE are intentionally inaccessible to browser roles.
-- Only the verified server-side Edge Function may advance the workflow.
comment on table public.ai_draft_runs is
  'Test only. Content is case-confidential; use only synthetic facts until privacy/audit readiness. No user UPDATE grants.';
