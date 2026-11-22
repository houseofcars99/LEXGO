-- Pre-CRM snapshot; internal same-database rollback aid, not a durable independent backup
create schema lexgo_backup_20261122_pre_crm authorization postgres;
revoke all on schema lexgo_backup_20261122_pre_crm from public, anon, authenticated;
create table lexgo_backup_20261122_pre_crm.organizations as table public.organizations with data;
create table lexgo_backup_20261122_pre_crm.memberships as table public.memberships with data;
create table lexgo_backup_20261122_pre_crm.cases as table public.cases with data;
create table lexgo_backup_20261122_pre_crm.case_members as table public.case_members with data;
create table lexgo_backup_20261122_pre_crm.tasks as table public.tasks with data;
create table lexgo_backup_20261122_pre_crm.deadlines as table public.deadlines with data;
create table lexgo_backup_20261122_pre_crm.deadline_changes as table public.deadline_changes with data;
create table lexgo_backup_20261122_pre_crm.function_definitions as
select p.proname as routine_name, pg_get_function_identity_arguments(p.oid) as args,
  pg_get_functiondef(p.oid) as definition, p.proacl::text as original_acl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
create table lexgo_backup_20261122_pre_crm.policy_definitions as
select schemaname,tablename,policyname,roles::text as roles,cmd,qual,with_check
from pg_policies where schemaname='public';
create table lexgo_backup_20261122_pre_crm.table_privileges as
select c.relname as relation_name,
       has_table_privilege('anon',c.oid,'SELECT') as anon_select,
       has_table_privilege('authenticated',c.oid,'SELECT') as auth_select,
       c.relacl::text as original_acl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p');
revoke all on all tables in schema lexgo_backup_20261122_pre_crm from public, anon, authenticated;
comment on schema lexgo_backup_20261122_pre_crm is
'LEXGO pre-CRM database-local snapshot 2026-11-22, privileged only. Not a complete external/PITR backup.';
