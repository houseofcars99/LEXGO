-- Draft-only billing documents; NOT legal invoices, not KSeF-submitted.
-- Apply after 20261025_fee_registry.sql.
begin;
create table if not exists public.billing_drafts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 fee_agreement_id uuid,
 buyer_name text not null check(length(trim(buyer_name)) between 2 and 200),
 buyer_address text not null default '',
 buyer_nip text not null default '',
 seller_name text not null check(length(trim(seller_name)) between 2 and 200),
 seller_address text not null default '',
 seller_nip text not null default '',
 service_name text not null check(length(trim(service_name)) between 2 and 240),
 gross_amount numeric(14,2) not null check(gross_amount > 0),
 vat_note text not null default 'Do ustalenia przez księgowość',
 notes text not null default '',
 status text not null default 'draft' check(status='draft'),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(fee_agreement_id,organization_id) references public.fee_agreements(id,organization_id)
);
create index if not exists billing_drafts_org on public.billing_drafts(organization_id,created_at desc);
alter table public.billing_drafts enable row level security;
create policy billing_draft_read on public.billing_drafts for select to authenticated
 using(public.is_admin(organization_id));
create policy billing_draft_insert on public.billing_drafts for insert to authenticated
 with check(public.is_admin(organization_id) and created_by=auth.uid() and status='draft');
create policy billing_draft_update on public.billing_drafts for update to authenticated
 using(public.is_admin(organization_id))
 with check(public.is_admin(organization_id) and status='draft');
create or replace function public.protect_billing_draft()
returns trigger language plpgsql set search_path = '' as $$
begin
 if (new.id,new.organization_id,new.created_by,new.created_at) is distinct from
    (old.id,old.organization_id,old.created_by,old.created_at)
 then raise exception 'Billing draft ownership cannot change'; end if;
 new.updated_at=now(); return new;
end $$;
create trigger billing_draft_protect before update on public.billing_drafts
for each row execute function public.protect_billing_draft();
commit;
