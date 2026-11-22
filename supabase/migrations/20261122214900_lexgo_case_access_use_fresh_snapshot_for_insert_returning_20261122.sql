-- Temporary mitigation, superseded by the following case_read RLS policy correction.
alter function public.can_access_case(uuid, uuid) volatile;
