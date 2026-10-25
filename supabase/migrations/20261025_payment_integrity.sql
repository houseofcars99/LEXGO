-- Run after 20261025_fee_registry.sql. Server-side safeguards for manual payment recording.
begin;
create or replace function public.validate_fee_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare agreed numeric(14,2); received numeric(14,2);
begin
  if tg_op <> 'INSERT' then raise exception 'Recorded payments cannot be modified'; end if;
  -- Lock the agreement row to serialize concurrent payments.
  select f.amount_gross into agreed
  from public.fee_agreements f
  where f.id=new.fee_agreement_id and f.organization_id=new.organization_id
  for update;
  if not found then raise exception 'Fee agreement not found'; end if;
  select coalesce(sum(p.paid_amount),0) into received
  from public.fee_payments p where p.fee_agreement_id=new.fee_agreement_id;
  if received+new.paid_amount > agreed then
    raise exception 'Payment exceeds remaining fee balance';
  end if;
  return new;
end $$;
drop trigger if exists validate_fee_payment_insert on public.fee_payments;
create trigger validate_fee_payment_insert before insert on public.fee_payments
for each row execute function public.validate_fee_payment();

create or replace function public.prevent_fee_reduction_below_paid()
returns trigger language plpgsql security definer set search_path = '' as $$
declare received numeric(14,2);
begin
  if (new.id,new.organization_id,new.case_id,new.created_by) is distinct from
     (old.id,old.organization_id,old.case_id,old.created_by)
    then raise exception 'Fee ownership cannot change'; end if;
  select coalesce(sum(p.paid_amount),0) into received
  from public.fee_payments p where p.fee_agreement_id=old.id;
  if new.amount_gross < received then raise exception 'Fee cannot be reduced below payments'; end if;
  return new;
end $$;
drop trigger if exists prevent_fee_reduction on public.fee_agreements;
create trigger prevent_fee_reduction before update on public.fee_agreements
for each row execute function public.prevent_fee_reduction_below_paid();
commit;
