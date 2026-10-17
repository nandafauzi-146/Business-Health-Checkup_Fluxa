-- Registration approval and seven-day owner trial lifecycle.
-- Existing accounts remain approved. Public registrations are created as pending.

alter table public.profiles
  add column if not exists email text,
  add column if not exists approval_status text,
  add column if not exists approved_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

update public.profiles as profiles
set email = users.email
from auth.users as users
where profiles.id = users.id
  and profiles.email is distinct from users.email;

update public.profiles
set approval_status = 'approved'
where approval_status is null;

alter table public.profiles
  alter column approval_status set default 'approved',
  alter column approval_status set not null;

alter table public.profiles
  drop constraint if exists profiles_role_check,
  add constraint profiles_role_check
    check (role in ('kasir', 'admin', 'owner', 'super_admin')),
  drop constraint if exists profiles_approval_status_check,
  add constraint profiles_approval_status_check
    check (approval_status in ('pending', 'approved', 'rejected'));

create index if not exists idx_profiles_pending_approval
  on public.profiles (created_at)
  where approval_status = 'pending';

create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles
  where id = auth.uid() and approval_status = 'approved';
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
      and role in ('admin', 'owner')
  );
$$;

create or replace function public.is_owner()
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
      and role = 'owner'
  );
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
      and role in ('kasir', 'admin', 'owner')
  );
$$;

create or replace function public.is_super_admin()
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
      and role = 'super_admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  insert into public.profiles (id, full_name, role, phone, email, approval_status)
  values (
    new.id,
    v_name,
    'kasir',
    new.raw_user_meta_data->>'phone',
    new.email,
    'pending'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role
    and coalesce(auth.role(), '') <> 'service_role'
    and session_user not in ('postgres', 'supabase_admin')
    and not public.is_admin_or_owner() then
    raise exception 'Akses ditolak: perubahan role hanya dapat dilakukan oleh Admin atau Owner.';
  end if;
  return new;
end;
$$;

create or replace function public.guard_profile_approval_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
    or session_user in ('postgres', 'supabase_admin') then
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

drop trigger if exists trg_guard_profile_approval_change on public.profiles;
create trigger trg_guard_profile_approval_change
  before update on public.profiles
  for each row execute function public.guard_profile_approval_change();

create or replace function public.guard_approved_business_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
    or session_user in ('postgres', 'supabase_admin') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if not public.is_staff() then
    raise exception 'Akun belum disetujui untuk mengakses data bisnis.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'categories',
    'products',
    'customers',
    'shifts',
    'sales',
    'sale_items',
    'stock_movements',
    'expense_categories',
    'expenses',
    'receivables',
    'receivable_payments',
    'checkups',
    'audit_logs'
  ]
  loop
    execute format('drop trigger if exists trg_approved_business_actor on public.%I', table_name);
    execute format(
      'create trigger trg_approved_business_actor before insert or update or delete on public.%I for each row execute function public.guard_approved_business_actor()',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists "Profiles dapat dilihat oleh pengguna terotentikasi" on public.profiles;
create policy "Pengguna dapat melihat profil yang diizinkan"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin_or_owner());

-- Create the first Super Admin manually after this migration, for example:
-- update public.profiles
-- set role = 'super_admin', approval_status = 'approved'
-- where email = 'operator@example.com';
