-- Allow an authorized admin to read a newly inserted case in INSERT...RETURNING.
-- Previously case_read relied only on can_access_case(id), whose lookup could
-- not see a not-yet-inserted case row during RLS RETURNING checks.
alter policy case_read on public.cases
  using (public.is_admin(organization_id) or public.can_access_case(id));
alter function public.can_access_case(uuid,uuid) stable;
