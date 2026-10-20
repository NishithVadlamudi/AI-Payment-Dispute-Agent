begin;

create table public.eval_reports (
  id uuid primary key,
  suite_name text not null,
  suite_sha256 text not null,
  mode text not null check (mode = 'live'),
  model text not null,
  provider text not null,
  status text not null check (status in ('running', 'completed', 'partial', 'failed')),
  dataset_size integer not null check (dataset_size between 30 and 50),
  total_cases integer not null check (total_cases > 0),
  passed integer not null default 0,
  infrastructure_errors integer not null default 0,
  average_latency_ms integer,
  average_cost_microusd bigint,
  cost_coverage integer not null default 0,
  results jsonb not null default '[]'::jsonb check (jsonb_typeof(results) = 'array'),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create table public.agent_runs (
  id uuid primary key,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  source text not null check (source in ('chat', 'eval')),
  eval_report_id uuid references public.eval_reports(id),
  model text not null,
  provider text not null,
  prompt_version text not null,
  status text not null check (status in ('running', 'succeeded', 'limited', 'blocked', 'failed', 'cancelled')),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  tool_calls jsonb not null default '[]'::jsonb check (jsonb_typeof(tool_calls) = 'array'),
  input_tokens bigint check (input_tokens >= 0),
  output_tokens bigint check (output_tokens >= 0),
  estimated_cost_microusd bigint check (estimated_cost_microusd >= 0),
  allocated_cost_microusd bigint not null default 0 check (allocated_cost_microusd >= 0),
  latency_ms integer check (latency_ms >= 0),
  final_text text not null default '',
  error_message text,
  started_at timestamptz not null,
  finished_at timestamptz
);
create index agent_runs_started_idx on public.agent_runs(started_at desc);
create index agent_runs_eval_idx on public.agent_runs(eval_report_id);
create index eval_reports_started_idx on public.eval_reports(started_at desc);
alter table public.agent_runs enable row level security;
alter table public.eval_reports enable row level security;
grant all on public.agent_runs, public.eval_reports to service_role;

-- Eval fixture cleanup must retain audit history and trace records.
alter table public.audit_log drop constraint audit_log_customer_id_fkey;
alter table public.audit_log add foreign key (customer_id) references public.customers(id) on delete set null;
notify pgrst, 'reload schema';
commit;
