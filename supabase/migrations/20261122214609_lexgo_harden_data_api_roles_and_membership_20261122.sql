-- Restrict anonymous access and prevent spoofed user ID in helper functions.
revoke all privileges on all tables in schema public from anon;
revoke execute on function public.audit_deadline() from public, anon, authenticated;
revoke execute on function public.protect_task() from public, anon, authenticated;
revoke execute on function public.is_member(uuid,uuid) from public, anon;
revoke execute on function public.is_admin(uuid,uuid) from public, anon;
revoke execute on function public.can_access_case(uuid,uuid) from public, anon;
revoke execute on function public.create_organization(text) from public, anon;
grant execute on function public.is_member(uuid,uuid) to authenticated;
grant execute on function public.is_admin(uuid,uuid) to authenticated;
grant execute on function public.can_access_case(uuid,uuid) to authenticated;
grant execute on function public.create_organization(text) to authenticated;

create or replace function public.is_member(org uuid, person uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = ''
as $function$
select coalesce(person = (select auth.uid()),false)
  and exists(select 1 from public.memberships where organization_id=org and user_id=person)
$function$;

create or replace function public.is_admin(org uuid, person uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = ''
as $function$
select coalesce(person = (select auth.uid()),false)
  and exists(select 1 from public.memberships where organization_id=org and user_id=person and role='admin')
$function$;

create or replace function public.can_access_case(cid uuid, person uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = ''
as $function$
select coalesce(person = (select auth.uid()),false)
  and exists(select 1 from public.cases c where c.id=cid
    and (public.is_admin(c.organization_id,person)
      or exists(select 1 from public.case_members cm where cm.case_id=cid and cm.user_id=person)))
$function$;

revoke execute on function public.is_member(uuid,uuid) from public, anon;
revoke execute on function public.is_admin(uuid,uuid) from public, anon;
revoke execute on function public.can_access_case(uuid,uuid) from public, anon;
grant execute on function public.is_member(uuid,uuid) to authenticated;
grant execute on function public.is_admin(uuid,uuid) to authenticated;
grant execute on function public.can_access_case(uuid,uuid) to authenticated;
