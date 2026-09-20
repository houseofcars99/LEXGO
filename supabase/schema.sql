-- Run once in a new Supabase project. The application never uses a service-role key.
create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 2 and 120),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','member')),
  created_at timestamptz not null default now(), primary key (organization_id,user_id)
);
create table public.cases (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 200), case_number text not null default '',
  client_name text not null default '', created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create table public.case_members (
  case_id uuid not null, organization_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
  primary key (case_id,user_id), foreign key (case_id,organization_id) references public.cases(id,organization_id) on delete cascade,
  foreign key (organization_id,user_id) references public.memberships(organization_id,user_id) on delete cascade
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, case_id uuid not null,
  title text not null check (length(trim(title)) between 2 and 240),
  status text not null default 'todo' check (status in ('todo','doing','done')),
  assignee_id uuid references auth.users(id), due_on date, created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (case_id,organization_id) references public.cases(id,organization_id) on delete cascade,
  foreign key (organization_id,assignee_id) references public.memberships(organization_id,user_id)
);
create table public.deadlines (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, case_id uuid not null,
  title text not null check (length(trim(title)) between 2 and 240), received_on date,
  due_on date not null, source_note text not null default '', legal_basis text not null default '',
  review_status text not null default 'needs_review' check (review_status in ('needs_review','confirmed')),
  created_by uuid not null references auth.users(id), confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (case_id,organization_id) references public.cases(id,organization_id) on delete cascade
);
create table public.deadline_changes (
  id bigint generated always as identity primary key, deadline_id uuid not null references public.deadlines(id) on delete cascade,
  actor_id uuid not null references auth.users(id), old_due_on date, new_due_on date not null,
  reason text not null default '', changed_at timestamptz not null default now()
);

create or replace function public.is_member(org uuid, person uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships where organization_id = org and user_id = person)
$$;
create or replace function public.is_admin(org uuid, person uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships where organization_id = org and user_id = person and role = 'admin')
$$;
create or replace function public.can_access_case(cid uuid, person uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.cases c where c.id = cid and
    (public.is_admin(c.organization_id,person) or exists
      (select 1 from public.case_members cm where cm.case_id = cid and cm.user_id = person)))
$$;

create or replace function public.create_organization(org_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Login required'; end if;
  insert into public.organizations(name,created_by) values (org_name,auth.uid()) returning id into new_id;
  insert into public.memberships(organization_id,user_id,role) values (new_id,auth.uid(),'admin');
  return new_id;
end $$;

create or replace function public.audit_deadline() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.deadline_changes(deadline_id,actor_id,new_due_on,reason)
      values (new.id,auth.uid(),new.due_on,'Utworzenie terminu');
  elsif old.due_on is distinct from new.due_on then
    insert into public.deadline_changes(deadline_id,actor_id,old_due_on,new_due_on,reason)
      values (new.id,auth.uid(),old.due_on,new.due_on,coalesce(nullif(current_setting('app.deadline_reason',true),''),'Korekta terminu'));
    new.review_status := 'needs_review'; new.confirmed_by := null; new.confirmed_at := null;
  end if;
  if tg_op = 'UPDATE' then
    if (new.id,new.organization_id,new.case_id,new.created_by) is distinct from
       (old.id,old.organization_id,old.case_id,old.created_by) then
      raise exception 'Identity and ownership of a deadline cannot be changed';
    end if;
    if new.review_status = 'confirmed' and
      (new.confirmed_by is distinct from auth.uid() or new.confirmed_at is null) then
      raise exception 'Confirmation must identify the current user';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger deadline_audit_insert after insert on public.deadlines for each row execute function public.audit_deadline();
create trigger deadline_audit_update before update on public.deadlines for each row execute function public.audit_deadline();
create or replace function public.protect_task() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.id,new.organization_id,new.case_id,new.created_by) is distinct from
     (old.id,old.organization_id,old.case_id,old.created_by) then
    raise exception 'Identity and ownership of a task cannot be changed';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger task_protect before update on public.tasks for each row execute function public.protect_task();

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.cases enable row level security;
alter table public.case_members enable row level security;
alter table public.tasks enable row level security;
alter table public.deadlines enable row level security;
alter table public.deadline_changes enable row level security;

create policy org_read on public.organizations for select to authenticated using (public.is_member(id));
create policy membership_read on public.memberships for select to authenticated using (public.is_member(organization_id));
create policy membership_insert on public.memberships for insert to authenticated with check (public.is_admin(organization_id));
create policy membership_delete on public.memberships for delete to authenticated using (public.is_admin(organization_id) and user_id <> auth.uid());
create policy case_read on public.cases for select to authenticated using (public.can_access_case(id));
create policy case_insert on public.cases for insert to authenticated with check (public.is_admin(organization_id) and created_by = auth.uid());
create policy case_update on public.cases for update to authenticated using (public.is_admin(organization_id)) with check (public.is_admin(organization_id));
create policy case_member_read on public.case_members for select to authenticated using (public.can_access_case(case_id));
create policy case_member_insert on public.case_members for insert to authenticated with check (public.is_admin(organization_id));
create policy case_member_delete on public.case_members for delete to authenticated using (public.is_admin(organization_id));
create policy task_read on public.tasks for select to authenticated using (public.can_access_case(case_id));
create policy task_insert on public.tasks for insert to authenticated with check (public.can_access_case(case_id) and created_by = auth.uid());
create policy task_update on public.tasks for update to authenticated using (public.can_access_case(case_id) and (public.is_admin(organization_id) or assignee_id = auth.uid() or created_by = auth.uid())) with check (public.can_access_case(case_id));
create policy task_delete on public.tasks for delete to authenticated using (public.is_admin(organization_id));
create policy deadline_read on public.deadlines for select to authenticated using (public.can_access_case(case_id));
create policy deadline_insert on public.deadlines for insert to authenticated with check (public.can_access_case(case_id) and created_by = auth.uid() and review_status = 'needs_review');
create policy deadline_update on public.deadlines for update to authenticated using (public.can_access_case(case_id)) with check (public.can_access_case(case_id));
create policy change_read on public.deadline_changes for select to authenticated using (public.can_access_case((select d.case_id from public.deadlines d where d.id = deadline_id)));

revoke all on function public.is_member(uuid,uuid), public.is_admin(uuid,uuid), public.can_access_case(uuid,uuid) from public;
revoke all on function public.create_organization(text) from public;
grant execute on function public.is_member(uuid,uuid), public.is_admin(uuid,uuid), public.can_access_case(uuid,uuid), public.create_organization(text) to authenticated;
