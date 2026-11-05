-- 0036_configurable_trial_duration.sql
-- Configurable initial trial duration and automatic active trial extension

-- 1. System Settings table for persistent platform configurations
create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_system_settings_key on public.system_settings(key);
alter table public.system_settings enable row level security;

-- Seed default initial trial duration (7 days) if not already present
insert into public.system_settings (key, value, description)
values ('trial_duration_days', '7'::jsonb, 'Durasi trial awal akun owner baru (dalam hari)')
on conflict (key) do nothing;

-- 2. Trial extension history table for audit and idempotent traceability
create table if not exists public.trial_extension_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  previous_duration_days integer not null,
  new_duration_days integer not null,
  additional_days integer not null,
  config_version uuid not null default gen_random_uuid(),
  previous_trial_ends_at timestamptz,
  new_trial_ends_at timestamptz,
  extended_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_trial_ext_hist_user on public.trial_extension_history(user_id, created_at desc);
create index if not exists idx_trial_ext_hist_config on public.trial_extension_history(config_version);
alter table public.trial_extension_history enable row level security;

-- 3. RLS policies
drop policy if exists "Super Admin dapat melihat dan mengelola system_settings" on public.system_settings;
create policy "Super Admin dapat melihat dan mengelola system_settings"
  on public.system_settings
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "Super Admin dapat melihat trial_extension_history" on public.trial_extension_history;
create policy "Super Admin dapat melihat trial_extension_history"
  on public.trial_extension_history
  for select
  to authenticated
  using (public.is_super_admin() or user_id = auth.uid());

-- 4. Guard update trigger on profiles
-- Ensure super admin or service role can safely adjust trial_ends_at during configuration changes
create or replace function public.guard_profile_approval_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
    or public.is_super_admin() then
    return new;
  end if;

  if old.approval_status is distinct from new.approval_status
    or old.approved_at is distinct from new.approved_at
    or old.reviewed_by is distinct from new.reviewed_by
    or old.reviewed_at is distinct from new.reviewed_at
    or old.trial_started_at is distinct from new.trial_started_at
    or old.trial_ends_at is distinct from new.trial_ends_at
    or old.email is distinct from new.email then
    raise exception 'Akses ditolak: status persetujuan dan trial hanya dapat diubah oleh layanan atau Super Admin.';
  end if;

  return new;
end;
$$;

-- 5. Helper function to read active initial trial duration
create or replace function public.get_initial_trial_duration()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select coalesce((value#>>'{}')::integer, (value)::text::integer) from public.system_settings where key = 'trial_duration_days'),
    7
  );
$$;

-- 6. Atomic function to update trial duration configuration and extend active eligible trials
create or replace function public.update_trial_duration_settings(
  p_new_duration integer,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_setting_id uuid;
  v_prev_duration integer;
  v_diff integer;
  v_config_version uuid;
  v_users_extended integer := 0;
  v_total_additional_days integer := 0;
  v_result jsonb;
begin
  -- 1. Authorization check
  v_actor := coalesce(p_actor_id, auth.uid());
  if coalesce(auth.role(), '') <> 'service_role'
     and session_user not in ('postgres', 'supabase_admin')
     and not public.is_super_admin() then
    raise exception 'Akses ditolak: Hanya Super Admin yang dapat mengubah durasi trial.';
  end if;

  -- 2. Validation
  if p_new_duration is null or p_new_duration <= 0 then
    raise exception 'Durasi trial harus berupa bilangan bulat lebih dari 0.';
  end if;

  -- 3. Lock or initialize trial_duration_days row
  insert into public.system_settings (key, value, description, updated_by)
  values ('trial_duration_days', '7'::jsonb, 'Durasi trial awal akun owner baru (dalam hari)', v_actor)
  on conflict (key) do nothing;

  select id, coalesce((value#>>'{}')::integer, (value)::text::integer, 7)
  into v_setting_id, v_prev_duration
  from public.system_settings
  where key = 'trial_duration_days'
  for update;

  v_config_version := gen_random_uuid();

  -- 4. Save new configuration value
  update public.system_settings
  set value = to_jsonb(p_new_duration),
      updated_by = v_actor,
      updated_at = now()
  where key = 'trial_duration_days';

  -- 5. Calculate difference
  v_diff := p_new_duration - v_prev_duration;

  -- 6. If increased, atomically extend active eligible trials
  if v_diff > 0 then
    with eligible_users as (
      select
        p.id,
        p.trial_ends_at as prev_ends_at,
        p.trial_ends_at + make_interval(days => v_diff) as next_ends_at
      from public.profiles p
      where p.role = 'owner'
        and p.approval_status = 'approved'
        and p.trial_ends_at is not null
        and p.trial_ends_at > now()
        and not exists (
          select 1 from public.subscriptions s
          where s.owner_id = p.id
            and s.status in ('active', 'cancelled')
            and s.current_period_end > now()
        )
        and not exists (
          select 1 from public.subscription_payments sp
          where sp.owner_id = p.id
            and sp.status = 'success'
        )
      for update of p
    ),
    updated_profiles as (
      update public.profiles p
      set trial_ends_at = eu.next_ends_at
      from eligible_users eu
      where p.id = eu.id
      returning p.id, eu.prev_ends_at, eu.next_ends_at
    ),
    inserted_history as (
      insert into public.trial_extension_history (
        user_id,
        previous_duration_days,
        new_duration_days,
        additional_days,
        config_version,
        previous_trial_ends_at,
        new_trial_ends_at,
        extended_by,
        created_at
      )
      select
        up.id,
        v_prev_duration,
        p_new_duration,
        v_diff,
        v_config_version,
        up.prev_ends_at,
        up.next_ends_at,
        v_actor,
        now()
      from updated_profiles up
      returning id
    )
    select count(*) into v_users_extended from inserted_history;

    v_total_additional_days := v_users_extended * v_diff;
  end if;

  -- 7. Audit log
  insert into public.audit_logs (
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    created_at
  ) values (
    v_actor,
    'SUPER_ADMIN_TRIAL_DURATION_UPDATED',
    'system_settings',
    coalesce(v_setting_id, v_config_version),
    jsonb_build_object('trial_duration_days', v_prev_duration::text),
    jsonb_build_object(
      'trial_duration_days', p_new_duration::text,
      'previous_duration_days', v_prev_duration::text,
      'additional_days', greatest(0, v_diff)::text,
      'users_extended', v_users_extended::text,
      'total_additional_days', v_total_additional_days::text,
      'config_version', v_config_version::text
    ),
    now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'previous_duration_days', v_prev_duration,
    'new_duration_days', p_new_duration,
    'additional_days', greatest(0, v_diff),
    'users_extended', v_users_extended,
    'total_additional_days', v_total_additional_days,
    'config_version', v_config_version
  );

  return v_result;
end;
$$;

