-- LEXGO SaaS — projekt zmian schematu CRM klientów
-- Wykonaj tylko po zweryfikowaniu istniejącego schematu i po wykonaniu kopii zapasowej.
-- Wersja przedwdrożeniowa: nie była uruchamiana na rzeczywistej bazie.
-- NIE URUCHAMIAJ supabase/schema.sql ponownie w istniejącej bazie.

begin;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null default 'person' check (kind in ('person','company')),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 200),
  email text check (email is null or length(email) <= 254),
  phone text check (phone is null or length(phone) <= 40),
  tax_id text check (tax_id is null or length(tax_id) <= 40),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_id_organization_unique unique (id, organization_id)
);

create index if not exists clients_organization_name_idx
  on public.clients (organization_id, lower(display_name));

-- Nowy klient jest opcjonalny: dawne sprawy nadal działają dzięki client_name.
alter table public.cases add column if not exists client_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cases_client_organization_fk'
      and conrelid = 'public.cases'::regclass
  ) then
    alter table public.cases
      add constraint cases_client_organization_fk
      foreign key (client_id, organization_id)
      references public.clients(id, organization_id)
      on update restrict
      on delete restrict;
  end if;
end $$;

create index if not exists cases_client_id_idx on public.cases (client_id);

create or replace function public.clients_protect_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.id,new.organization_id,new.created_by,new.created_at) is distinct from
     (old.id,old.organization_id,old.created_by,old.created_at) then
    raise exception 'Nie można zmienić właściciela kartoteki klienta';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists clients_protect_ownership_tr on public.clients;
create trigger clients_protect_ownership_tr
before update on public.clients
for each row execute function public.clients_protect_ownership();

alter table public.clients enable row level security;

-- W pierwszym etapie pełne dane kontaktowe widzą wyłącznie administratorzy.
-- Dostęp do ogólnych nazw klientów w istniejących sprawach pozostaje bez zmian.
drop policy if exists clients_admin_read on public.clients;
create policy clients_admin_read on public.clients
  for select to authenticated
  using (public.is_admin(organization_id));

drop policy if exists clients_admin_insert on public.clients;
create policy clients_admin_insert on public.clients
  for insert to authenticated
  with check (public.is_admin(organization_id) and created_by = (select auth.uid()));

drop policy if exists clients_admin_update on public.clients;
create policy clients_admin_update on public.clients
  for update to authenticated
  using (public.is_admin(organization_id))
  with check (public.is_admin(organization_id));

-- Nie dodajemy polityki DELETE: przypadkowe usunięcie kartoteki jest zabronione.
revoke all on public.clients from anon;
grant select, insert, update on public.clients to authenticated;

revoke all on function public.clients_protect_ownership() from public;

commit;
