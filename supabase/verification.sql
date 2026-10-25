-- LEXGO: read-only post-migration checks (Supabase SQL Editor).
-- No data is inserted or changed.
select t.table_name,
       t.table_name in ('organizations','memberships','cases','case_members','tasks','deadlines','deadline_changes','fee_agreements','fee_payments','billing_drafts') as expected,
       coalesce(c.relrowsecurity,false) as rls_enabled
from information_schema.tables t
join pg_class c on c.oid=to_regclass('public.'||t.table_name)
where t.table_schema='public' and t.table_name in
 ('organizations','memberships','cases','case_members','tasks','deadlines','deadline_changes','fee_agreements','fee_payments','billing_drafts')
order by t.table_name;

select tablename, policyname, cmd, roles from pg_policies
where schemaname='public' and tablename in ('fee_agreements','fee_payments','billing_drafts')
order by tablename,policyname;

select tgrelid::regclass::text as table_name, tgname as trigger_name
from pg_trigger where not tgisinternal
and tgrelid in ('public.fee_payments'::regclass,'public.fee_agreements'::regclass,'public.billing_drafts'::regclass)
order by table_name,trigger_name;
