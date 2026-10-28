begin;

-- Keep the original reservation immutable for retries and auditability.
alter table public.ai_budget_reservations
  add column settled_microusd bigint check (settled_microusd between 0 and amount_microusd),
  add column settled_at timestamptz;

create function public.settle_ai_budget(p_id uuid, p_actual_microusd bigint)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  reservation public.ai_budget_reservations;
begin
  if p_id is null or p_actual_microusd is null or p_actual_microusd < 0 then
    raise exception 'Invalid settlement parameters';
  end if;
  select * into reservation from public.ai_budget_reservations where id = p_id;
  if not found then return false; end if;
  -- Match reserve_ai_budget's lock order: day bucket, then reservation.
  -- Use the reservation's original UTC day, never the current day.
  perform 1 from public.ai_daily_budgets
    where scope = reservation.scope and day = reservation.day for update;
  select * into reservation from public.ai_budget_reservations where id = p_id for update;
  if not found or p_actual_microusd > reservation.amount_microusd then return false; end if;
  if reservation.settled_microusd is not null then
    return reservation.settled_microusd = p_actual_microusd;
  end if;
  update public.ai_daily_budgets
    set allocated_microusd = allocated_microusd - (reservation.amount_microusd - p_actual_microusd)
    where scope = reservation.scope and day = reservation.day;
  update public.ai_budget_reservations
    set settled_microusd = p_actual_microusd, settled_at = clock_timestamp() where id = p_id;
  return true;
end $$;

revoke all on function public.settle_ai_budget(uuid,bigint) from public, anon;
grant execute on function public.settle_ai_budget(uuid,bigint) to service_role;
do $$ begin
  if exists(select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    revoke all on function public.settle_ai_budget(uuid,bigint) from authenticated;
  end if;
end $$;
commit;
