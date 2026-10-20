create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  type text not null check (type in ('card')),
  brand text not null,
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  unique (id, customer_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  payment_method_id uuid not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('pending', 'succeeded', 'declined')),
  merchant text not null,
  created_at timestamptz not null default now(),
  decline_code text,
  idempotency_key text not null unique,
  foreign key (payment_method_id, customer_id)
    references public.payment_methods(id, customer_id),
  check ((status = 'declined' and decline_code is not null) or
         (status <> 'declined' and decline_code is null)),
  unique (id, currency)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('pending_approval', 'pending', 'succeeded', 'rejected', 'failed')),
  reason text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (transaction_id, currency) references public.transactions(id, currency)
);

create table public.refund_policies (
  id uuid primary key default gen_random_uuid(),
  reason text not null unique,
  description text not null,
  window_days integer not null check (window_days > 0),
  requires_approval boolean not null default true check (requires_approval),
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  run_id uuid,
  actor text not null check (actor in ('agent', 'human', 'system')),
  action text not null,
  customer_id uuid references public.customers(id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index transactions_customer_created_idx on public.transactions(customer_id, created_at desc);
create index refunds_transaction_status_idx on public.refunds(transaction_id, status);
create index audit_log_run_created_idx on public.audit_log(run_id, created_at);

-- No anonymous browser access. Server routes use the service role and scoped queries.
alter table public.customers enable row level security;
alter table public.payment_methods enable row level security;
alter table public.transactions enable row level security;
alter table public.refunds enable row level security;
alter table public.refund_policies enable row level security;
alter table public.audit_log enable row level security;
