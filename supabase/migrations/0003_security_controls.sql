begin;

create table public.ai_request_windows (
  bucket_hash text primary key check (bucket_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0)
);
create index ai_request_windows_started_idx on public.ai_request_windows(window_started_at);

-- Scope is fixed to 'global' by the application. Separate scopes let integration
-- tests exercise concurrency without consuming or deleting the real demo budget.
create table public.ai_daily_budgets (
  scope text not null,
  day date not null,
  cap_microusd bigint not null check (cap_microusd > 0),
  allocated_microusd bigint not null default 0 check (allocated_microusd >= 0),
  primary key (scope, day)
);
create table public.ai_budget_reservations (
  id uuid primary key,
  scope text not null,
  day date not null,
  amount_microusd bigint not null check (amount_microusd > 0),
  created_at timestamptz not null default now(),
  foreign key (scope, day) references public.ai_daily_budgets(scope, day)
);

alter table public.ai_request_windows enable row level security;
alter table public.ai_daily_budgets enable row level security;
alter table public.ai_budget_reservations enable row level security;
grant all on public.ai_request_windows, public.ai_daily_budgets, public.ai_budget_reservations to service_role;

create function public.consume_ai_request(p_bucket text, p_limit integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  entry public.ai_request_windows;
  current_time_utc timestamptz := clock_timestamp();
begin
  if p_limit is null or p_limit not between 1 and 1000
    or p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid rate limit parameters';
  end if;
  delete from public.ai_request_windows where window_started_at < current_time_utc - interval '2 days';
  insert into public.ai_request_windows(bucket_hash, window_started_at, request_count)
    values(p_bucket, current_time_utc, 1)
    on conflict (bucket_hash) do update set
      window_started_at = case when ai_request_windows.window_started_at <= current_time_utc - interval '1 minute'
        then current_time_utc else ai_request_windows.window_started_at end,
      request_count = case when ai_request_windows.window_started_at <= current_time_utc - interval '1 minute'
        then 1 else least(ai_request_windows.request_count + 1, 1001) end
    returning * into entry;
  return jsonb_build_object('allowed', entry.request_count <= p_limit,
    'retry_after_seconds', greatest(1, ceil(extract(epoch from entry.window_started_at + interval '1 minute' - current_time_utc))::integer));
end $$;

create function public.reserve_ai_budget(
  p_id uuid, p_amount_microusd bigint, p_cap_microusd bigint, p_scope text default 'global'
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  budget public.ai_daily_budgets;
  existing public.ai_budget_reservations;
  utc_day date := (clock_timestamp() at time zone 'UTC')::date;
begin
  if p_id is null or p_amount_microusd is null or p_amount_microusd <= 0
    or p_cap_microusd is null or p_cap_microusd not between 1 and 1000000000
    or p_scope is null or length(p_scope) not between 1 and 100 then
    raise exception 'Invalid budget parameters';
  end if;
  insert into public.ai_daily_budgets(scope, day, cap_microusd)
    values(p_scope, utc_day, p_cap_microusd) on conflict do nothing;
  select * into budget from public.ai_daily_budgets
    where scope = p_scope and day = utc_day for update;
  -- Deployments cannot raise today's cap accidentally while old instances run.
  update public.ai_daily_budgets set cap_microusd = least(cap_microusd, p_cap_microusd)
    where scope = p_scope and day = utc_day returning * into budget;
  select * into existing from public.ai_budget_reservations where id = p_id;
  if found then
    return existing.scope = p_scope and existing.day = utc_day
      and existing.amount_microusd = p_amount_microusd;
  end if;
  if p_amount_microusd > budget.cap_microusd - budget.allocated_microusd then return false; end if;
  insert into public.ai_budget_reservations(id, scope, day, amount_microusd)
    values(p_id, p_scope, utc_day, p_amount_microusd);
  update public.ai_daily_budgets set allocated_microusd = allocated_microusd + p_amount_microusd
    where scope = p_scope and day = utc_day;
  return true;
end $$;

revoke all on function public.consume_ai_request(text,integer) from public, anon;
revoke all on function public.reserve_ai_budget(uuid,bigint,bigint,text) from public, anon;
grant execute on function public.consume_ai_request(text,integer) to service_role;
grant execute on function public.reserve_ai_budget(uuid,bigint,bigint,text) to service_role;
do $$ begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    revoke all on function public.consume_ai_request(text,integer) from authenticated;
    revoke all on function public.reserve_ai_budget(uuid,bigint,bigint,text) from authenticated;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
