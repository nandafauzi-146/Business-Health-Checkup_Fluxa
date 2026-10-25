create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  price integer not null check (price >= 0),
  duration_days integer not null check (duration_days > 0),
  max_users integer not null default 1 check (max_users > 0),
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete restrict,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  status text not null check (status in ('trialing', 'active', 'past_due', 'expired', 'cancelled', 'suspended')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_period_valid check (current_period_end > current_period_start)
);

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_name text not null,
  duration_days integer not null check (duration_days > 0),
  amount integer not null check (amount >= 0),
  currency text not null default 'IDR' check (currency = 'IDR'),
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'expired', 'cancelled', 'refunded')),
  gateway text not null default 'midtrans',
  gateway_transaction_id text,
  snap_token text,
  snap_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_owner_status
  on public.subscriptions (owner_id, status, current_period_end);
create index if not exists idx_subscription_payments_owner_created
  on public.subscription_payments (owner_id, created_at desc);
create index if not exists idx_subscription_payments_status_created
  on public.subscription_payments (status, created_at desc);

create table if not exists public.platform_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type text not null check (entry_type in ('subscription_payment', 'refund', 'gateway_fee', 'payout', 'adjustment', 'reversal')),
  direction text not null check (direction in ('credit', 'debit')),
  amount integer not null check (amount > 0),
  currency text not null default 'IDR' check (currency = 'IDR'),
  source_type text not null,
  source_id uuid not null,
  settlement_status text not null default 'unsettled' check (settlement_status in ('unsettled', 'settled')),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (entry_type, source_type, source_id),
  constraint settlement_timestamp_consistent check (
    (settlement_status = 'settled' and settled_at is not null)
    or (settlement_status = 'unsettled' and settled_at is null)
  )
);

create table if not exists public.midtrans_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_hash text not null unique,
  order_id text not null,
  transaction_status text not null,
  transaction_id text,
  received_at timestamptz not null default now()
);

create or replace function public.guard_profile_approval_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
    or session_user in ('postgres', 'supabase_admin', 'supabase_auth_admin') then
    return new;
  end if;

  if old.approval_status is distinct from new.approval_status
    or old.approved_at is distinct from new.approved_at
    or old.reviewed_by is distinct from new.reviewed_by
    or old.reviewed_at is distinct from new.reviewed_at
    or old.trial_started_at is distinct from new.trial_started_at
    or old.trial_ends_at is distinct from new.trial_ends_at
    or old.email is distinct from new.email then
    raise exception 'Akses ditolak: status persetujuan dan trial hanya dapat diubah oleh layanan.';
  end if;

  return new;
end;
$$;

create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_email_from_auth on auth.users;
create trigger trg_sync_profile_email_from_auth
  after update of email on auth.users
  for each row execute function public.sync_profile_email_from_auth();

create or replace function public.owner_has_active_access(p_owner_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_owner_id
      and p.role = 'owner'
      and p.approval_status = 'approved'
      and p.trial_started_at <= now()
      and p.trial_ends_at > now()
  ) or exists (
    select 1
    from public.subscriptions s
    where s.owner_id = p_owner_id
      and s.status in ('active', 'cancelled')
      and s.current_period_end > now()
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.owner_has_active_access(auth.uid());
$$;

create or replace function public.is_admin_or_owner()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and approval_status = 'approved'
      and role = 'admin'
  ) or public.owner_has_active_access(auth.uid());
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and approval_status = 'approved'
      and role in ('kasir', 'admin')
  ) or public.owner_has_active_access(auth.uid());
$$;

alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.platform_ledger_entries enable row level security;
alter table public.midtrans_webhook_events enable row level security;

drop policy if exists "Active plans are visible to approved users" on public.subscription_plans;
create policy "Active plans are visible to approved users"
  on public.subscription_plans for select to authenticated
  using (is_active and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.approval_status = 'approved'
  ));

drop policy if exists "Super admins manage plans" on public.subscription_plans;
create policy "Super admins manage plans"
  on public.subscription_plans for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "Owners read their subscription" on public.subscriptions;
create policy "Owners read their subscription"
  on public.subscriptions for select to authenticated
  using (owner_id = auth.uid() or public.is_super_admin());

drop policy if exists "Owners read their subscription payments" on public.subscription_payments;
create policy "Owners read their subscription payments"
  on public.subscription_payments for select to authenticated
  using (owner_id = auth.uid() or public.is_super_admin());

drop policy if exists "Super admins read platform ledger" on public.platform_ledger_entries;
create policy "Super admins read platform ledger"
  on public.platform_ledger_entries for select to authenticated
  using (public.is_super_admin());

drop policy if exists "Super admins read Midtrans events" on public.midtrans_webhook_events;
create policy "Super admins read Midtrans events"
  on public.midtrans_webhook_events for select to authenticated
  using (public.is_super_admin());

create or replace function public.prevent_platform_ledger_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Platform ledger entries are immutable.';
end;
$$;

drop trigger if exists trg_platform_ledger_immutable on public.platform_ledger_entries;
create trigger trg_platform_ledger_immutable
  before update or delete on public.platform_ledger_entries
  for each row execute function public.prevent_platform_ledger_mutation();

create or replace function public.apply_midtrans_subscription_payment(
  p_order_id text,
  p_status text,
  p_transaction_id text,
  p_paid_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.subscription_payments%rowtype;
  current_row public.subscriptions%rowtype;
  next_start timestamptz;
  next_end timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  if p_status not in ('pending', 'success', 'failed', 'expired', 'cancelled', 'refunded') then
    raise exception 'Unsupported payment status.';
  end if;

  select * into payment_row
  from public.subscription_payments
  where order_id = p_order_id
  for update;

  if not found then
    raise exception 'Subscription payment not found.';
  end if;

  if payment_row.status = 'refunded'
    or (payment_row.status = 'success' and p_status <> 'refunded') then
    return;
  end if;
  if p_status = 'refunded' and payment_row.status <> 'success' then
    raise exception 'Only successful payments can be refunded.';
  end if;

  update public.subscription_payments
  set status = p_status,
      gateway_transaction_id = coalesce(p_transaction_id, gateway_transaction_id),
      paid_at = case when p_status = 'success' then coalesce(p_paid_at, now()) else paid_at end,
      updated_at = now()
  where id = payment_row.id;

  insert into public.midtrans_webhook_events (
    event_hash, order_id, transaction_status, transaction_id
  )
  values (
    encode(digest(p_order_id || ':' || p_status || ':' || coalesce(p_transaction_id, ''), 'sha256'), 'hex'),
    p_order_id, p_status, p_transaction_id
  )
  on conflict (event_hash) do nothing;

  if p_status = 'refunded' then
    update public.subscriptions
    set status = 'suspended',
        updated_at = now()
    where owner_id = payment_row.owner_id;

    insert into public.platform_ledger_entries (
      entry_type, direction, amount, source_type, source_id
    )
    values (
      'reversal', 'debit', payment_row.amount, 'subscription_payment', payment_row.id
    )
    on conflict (entry_type, source_type, source_id) do nothing;
    return;
  end if;

  if p_status <> 'success' then
    return;
  end if;

  select * into current_row
  from public.subscriptions
  where owner_id = payment_row.owner_id
  for update;

  next_start := greatest(now(), coalesce(current_row.current_period_end, now()));
  next_end := next_start + make_interval(days => payment_row.duration_days);

  insert into public.subscriptions (
    owner_id, plan_id, status, current_period_start, current_period_end, cancel_at_period_end
  )
  values (
    payment_row.owner_id, payment_row.plan_id, 'active', next_start, next_end, false
  )
  on conflict (owner_id) do update set
    plan_id = excluded.plan_id,
    status = 'active',
    current_period_start = greatest(now(), public.subscriptions.current_period_end),
    current_period_end = greatest(now(), public.subscriptions.current_period_end)
      + make_interval(days => payment_row.duration_days),
    cancel_at_period_end = false,
    updated_at = now()
  returning id into payment_row.subscription_id;

  update public.subscription_payments
  set subscription_id = payment_row.subscription_id
  where id = payment_row.id;

  insert into public.platform_ledger_entries (
    entry_type, direction, amount, source_type, source_id
  )
  values (
    'subscription_payment', 'credit', payment_row.amount, 'subscription_payment', payment_row.id
  )
  on conflict (entry_type, source_type, source_id) do nothing;

  update public.profiles
  set trial_ends_at = coalesce(trial_ends_at, now())
  where id = payment_row.owner_id;
end;
$$;

create or replace function public.super_admin_subscription_finance(
  p_actor_id uuid,
  p_start timestamptz default null,
  p_end timestamptz default null,
  p_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and role = 'super_admin' and approval_status = 'approved'
  ) then
    raise exception 'Super Admin permission required.';
  end if;

  select jsonb_build_object(
    'totalPayments', count(*),
    'grossRevenue', coalesce(sum(amount) filter (where status = 'success'), 0),
    'pendingAmount', coalesce(sum(amount) filter (where status = 'pending'), 0),
    'pendingCount', count(*) filter (where status = 'pending'),
    'failedAmount', coalesce(sum(amount) filter (where status in ('failed', 'expired', 'cancelled')), 0),
    'failedCount', count(*) filter (where status in ('failed', 'expired', 'cancelled')),
    'refundedAmount', coalesce(sum(amount) filter (where status = 'refunded'), 0),
    'refundedCount', count(*) filter (where status = 'refunded'),
    'byPlan', coalesce((
      select jsonb_agg(jsonb_build_object('plan', plan_name, 'grossRevenue', plan_revenue, 'payments', payment_count))
      from (
        select plan_name,
          coalesce(sum(amount) filter (where status = 'success'), 0) as plan_revenue,
          count(*) as payment_count
        from public.subscription_payments
        where (p_start is null or created_at >= p_start)
          and (p_end is null or created_at < p_end)
          and (p_status is null or status = p_status)
        group by plan_name
        order by plan_name
      ) grouped_plans
    ), '[]'::jsonb)
  ) into result
  from public.subscription_payments
  where (p_start is null or created_at >= p_start)
    and (p_end is null or created_at < p_end)
    and (p_status is null or status = p_status);

  return result;
end;
$$;

revoke all on function public.owner_has_active_access(uuid) from public, anon;
revoke all on function public.apply_midtrans_subscription_payment(text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.super_admin_subscription_finance(uuid, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.apply_midtrans_subscription_payment(text, text, text, timestamptz) to service_role;
grant execute on function public.super_admin_subscription_finance(uuid, timestamptz, timestamptz, text) to service_role;

grant select on public.subscription_plans, public.subscriptions, public.subscription_payments to authenticated;
grant select on public.platform_ledger_entries, public.midtrans_webhook_events to authenticated;
grant all on public.subscription_plans, public.subscriptions, public.subscription_payments,
  public.platform_ledger_entries, public.midtrans_webhook_events to service_role;
