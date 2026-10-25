-- LEXGO finance registry. Apply after supabase/schema.sql, once per project.
-- Store only test data until tenant-isolation and privacy review is completed.
begin;
create table if not exists public.fee_agreements (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 case_id uuid not null,
 description text not null default 'Wynagrodzenie',
 amount_gross numeric(14,2) not null check(amount_gross >= 0),
 currency text not null default 'PLN' check(currency = 'PLN'),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(id,organization_id),
 foreign key(case_id,organization_id) references public.cases(id,organization_id) on delete cascade
);
create table if not exists public.fee_payments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 fee_agreement_id uuid not null,
 paid_amount numeric(14,2) not null check(paid_amount > 0),
 paid_on date not null,
 method text not null default 'przelew' check(method in ('przelew','gotowka','inne')),
 note text not null default '',
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 foreign key(fee_agreement_id,organization_id) references public.fee_agreements(id,organization_id) on delete cascade
);
create index if not exists fee_agreements_org_case on public.fee_agreements(organization_id,case_id);
create index if not exists fee_payments_fee on public.fee_payments(fee_agreement_id);
alter table public.fee_agreements enable row level security;
alter table public.fee_payments enable row level security;
create policy fee_read on public.fee_agreements for select to authenticated
 using(public.can_access_case(case_id));
create policy fee_insert on public.fee_agreements for insert to authenticated
 with check(public.is_admin(organization_id) and created_by=auth.uid());
create policy fee_update on public.fee_agreements for update to authenticated
 using(public.is_admin(organization_id)) with check(public.is_admin(organization_id));
create policy payment_read on public.fee_payments for select to authenticated
 using(exists(select 1 from public.fee_agreements f where f.id=fee_agreement_id and f.organization_id=fee_payments.organization_id and public.can_access_case(f.case_id)));
create policy payment_insert on public.fee_payments for insert to authenticated
 with check(public.is_admin(organization_id) and created_by=auth.uid()
 and exists(select 1 from public.fee_agreements f where f.id=fee_agreement_id and f.organization_id=fee_payments.organization_id));
-- No delete policies: preserve accounting history until audited correction workflow exists.
commit;
