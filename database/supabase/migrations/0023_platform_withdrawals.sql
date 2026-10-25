-- ==============================================================================
-- 0020_platform_withdrawals.sql
-- FR-04: Pencatatan withdraw internal dana platform oleh Super Admin.
-- Catatan ini adalah pencatatan internal, bukan transfer/pencairan uang riil otomatis.
-- ==============================================================================

create table if not exists public.platform_withdrawals (
  id uuid primary key default gen_random_uuid(),
  amount integer not null check (amount > 0),
  currency text not null default 'IDR' check (currency = 'IDR'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  reference_number text not null unique,
  destination text not null,
  notes text not null default '',
  created_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_platform_withdrawals_created
  on public.platform_withdrawals (created_at desc);

create index if not exists idx_platform_withdrawals_status
  on public.platform_withdrawals (status, created_at desc);

create index if not exists idx_platform_withdrawals_created_by
  on public.platform_withdrawals (created_by);

-- Trigger auto updated_at
create or replace function public.set_platform_withdrawals_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_platform_withdrawals_updated_at on public.platform_withdrawals;
create trigger trg_platform_withdrawals_updated_at
  before update on public.platform_withdrawals
  for each row execute function public.set_platform_withdrawals_updated_at();

-- RLS
alter table public.platform_withdrawals enable row level security;

drop policy if exists "Super admins manage platform withdrawals" on public.platform_withdrawals;
create policy "Super admins manage platform withdrawals"
  on public.platform_withdrawals for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

grant select, insert, update on public.platform_withdrawals to authenticated;
grant all on public.platform_withdrawals to service_role;
