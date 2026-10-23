-- Registration path tracking and auto-approve on successful payment.

-- 1. Add registration_path to profiles
alter table public.profiles
  add column if not exists registration_path text;

-- Default existing rows to 'trial' (they used the original flow)
update public.profiles
set registration_path = 'trial'
where registration_path is null and role = 'owner';

alter table public.profiles
  drop constraint if exists profiles_registration_path_check,
  add constraint profiles_registration_path_check
    check (registration_path is null or registration_path in ('subscribe', 'trial'));

-- 2. Add rejection_reason to profiles
alter table public.profiles
  add column if not exists rejection_reason text;

-- 3. Update apply_midtrans_subscription_payment to auto-approve on success
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

  -- === AUTO-APPROVE on successful payment ===
  update public.profiles
  set approval_status = 'approved',
      approved_at = coalesce(approved_at, now()),
      reviewed_at = coalesce(reviewed_at, now())
  where id = payment_row.owner_id
    and approval_status = 'pending';

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
