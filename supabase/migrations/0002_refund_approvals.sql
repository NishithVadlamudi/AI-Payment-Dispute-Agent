begin;

-- One ledger entry represents one completed mock payment operation. No external rails.
create table public.refund_executions (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null unique references public.refunds(id),
  idempotency_key text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now()
);
alter table public.refund_executions enable row level security;
grant select on public.refund_executions to anon;
grant all on public.refund_executions to service_role;
create unique index refunds_one_approval_per_transaction
  on public.refunds(transaction_id) where status = 'pending_approval';

create function public.request_demo_refund(
  p_customer_id uuid, p_transaction_id uuid, p_amount_cents integer,
  p_reason text, p_idempotency_key text, p_run_id uuid
) returns public.refunds language plpgsql security invoker set search_path = '' as $$
declare
  charge public.transactions;
  existing public.refunds;
  requested public.refunds;
  reserved bigint;
begin
  -- Every request and decision locks the charge first: concurrent partial refunds
  -- cannot both spend the same available balance or deadlock on opposite lock orders.
  select t.* into charge from public.transactions t
    join public.customers c on c.id = t.customer_id and c.is_demo
    where t.id = p_transaction_id and t.customer_id = p_customer_id for update of t;
  if not found then raise exception 'REFUND_NOT_FOUND'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_reason is null
    or length(btrim(p_reason)) < 3 or length(p_reason) > 2000
    or p_idempotency_key is null or length(p_idempotency_key) not between 1 and 200
    or p_run_id is null then raise exception 'REFUND_INVALID_INPUT'; end if;
  select * into existing from public.refunds where idempotency_key = p_idempotency_key;
  if found then
    if existing.transaction_id <> p_transaction_id or existing.amount_cents <> p_amount_cents
      or existing.reason <> btrim(p_reason) then raise exception 'REFUND_KEY_CONFLICT'; end if;
    return existing;
  end if;
  if charge.status <> 'succeeded' then raise exception 'REFUND_NOT_SETTLED'; end if;
  select * into existing from public.refunds
    where transaction_id = charge.id and status = 'pending_approval';
  if found then
    if existing.amount_cents <> p_amount_cents then raise exception 'REFUND_ALREADY_REQUESTED'; end if;
    return existing;
  end if;
  select coalesce(sum(amount_cents), 0) into reserved from public.refunds
    where transaction_id = charge.id and status in ('pending_approval', 'pending', 'succeeded');
  if p_amount_cents > charge.amount_cents - reserved then raise exception 'REFUND_EXCEEDS_AVAILABLE'; end if;
  insert into public.refunds(transaction_id, amount_cents, currency, status, reason, idempotency_key)
    values(charge.id, p_amount_cents, charge.currency, 'pending_approval', btrim(p_reason), p_idempotency_key)
    returning * into requested;
  insert into public.audit_log(run_id, actor, action, customer_id, payload)
    values(p_run_id, 'agent', 'refund_requested', p_customer_id,
      jsonb_build_object('refund_id', requested.id, 'transaction_id', charge.id,
        'amount_cents', requested.amount_cents, 'reason', requested.reason));
  return requested;
end $$;

create function public.decide_demo_refund(p_refund_id uuid, p_decision text)
returns public.refunds language plpgsql security invoker set search_path = '' as $$
declare
  charge public.transactions;
  requested public.refunds;
  other_reserved bigint;
  target_status text;
  replay boolean := false;
begin
  if p_decision is null or p_decision not in ('approve', 'reject') then raise exception 'REFUND_INVALID_INPUT'; end if;
  select t.* into charge from public.transactions t
    join public.refunds r on r.transaction_id = t.id
    join public.customers c on c.id = t.customer_id and c.is_demo
    where r.id = p_refund_id for update of t;
  if not found then raise exception 'REFUND_NOT_FOUND'; end if;
  select * into requested from public.refunds where id = p_refund_id for update;
  target_status := case when p_decision = 'approve' then 'succeeded' else 'rejected' end;
  if requested.status = target_status then
    replay := true;
  elsif requested.status <> 'pending_approval' then
    raise exception 'REFUND_DECISION_CONFLICT';
  else
    if p_decision = 'approve' then
      if charge.status <> 'succeeded' then raise exception 'REFUND_NOT_SETTLED'; end if;
      select coalesce(sum(amount_cents), 0) into other_reserved from public.refunds
        where transaction_id = charge.id and id <> requested.id
          and status in ('pending_approval', 'pending', 'succeeded');
      if requested.amount_cents > charge.amount_cents - other_reserved then
        raise exception 'REFUND_EXCEEDS_AVAILABLE';
      end if;
      insert into public.refund_executions(refund_id, idempotency_key, amount_cents, currency)
        values(requested.id, 'mock-refund:' || requested.id::text, requested.amount_cents, requested.currency);
    end if;
    update public.refunds set status = target_status, updated_at = now()
      where id = requested.id returning * into requested;
  end if;
  insert into public.audit_log(actor, action, customer_id, payload)
    values('human', case when replay then 'refund_decision_replayed'
      when p_decision = 'approve' then 'refund_approved' else 'refund_rejected' end,
      charge.customer_id, jsonb_build_object('refund_id', requested.id,
        'decision', p_decision, 'actor_label', 'demo_reviewer', 'amount_cents', requested.amount_cents));
  return requested;
end $$;

-- Supabase normally grants function execution to PUBLIC. These mutations are server-only.
revoke all on function public.request_demo_refund(uuid,uuid,integer,text,text,uuid) from public, anon;
revoke all on function public.decide_demo_refund(uuid,text) from public, anon;
grant execute on function public.request_demo_refund(uuid,uuid,integer,text,text,uuid) to service_role;
grant execute on function public.decide_demo_refund(uuid,text) to service_role;
do $$ begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    revoke all on function public.request_demo_refund(uuid,uuid,integer,text,text,uuid) from authenticated;
    revoke all on function public.decide_demo_refund(uuid,text) from authenticated;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
