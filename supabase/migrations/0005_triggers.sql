-- 0005_triggers.sql
-- Triggers: handle_new_user, updated_at, dan guard anti eskalasi role

-- 1. Fungsi & Trigger update updated_at otomatis
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger trg_categories_updated_at before update on public.categories
  for each row execute function public.handle_updated_at();

create trigger trg_products_updated_at before update on public.products
  for each row execute function public.handle_updated_at();

create trigger trg_customers_updated_at before update on public.customers
  for each row execute function public.handle_updated_at();

create trigger trg_shifts_updated_at before update on public.shifts
  for each row execute function public.handle_updated_at();

create trigger trg_sales_updated_at before update on public.sales
  for each row execute function public.handle_updated_at();

create trigger trg_expenses_updated_at before update on public.expenses
  for each row execute function public.handle_updated_at();

create trigger trg_receivables_updated_at before update on public.receivables
  for each row execute function public.handle_updated_at();

-- 2. Fungsi & Trigger handle_new_user dari auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_name text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'kasir');
  if v_role not in ('kasir', 'admin', 'owner') then
    v_role := 'kasir';
  end if;

  v_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  insert into public.profiles (id, full_name, role, phone)
  values (new.id, v_name, v_role, new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Trigger pada auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Guard Anti-Eskalasi Role (trg_guard_profile_role_change)
-- Sesuai aturan: user biasa tidak boleh mengubah role-nya sendiri ke admin/owner
create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role then
    -- Hanya admin atau owner yang berhak mengubah role akun
    if not public.is_admin_or_owner() then
      raise exception 'Akses ditolak: Hanya Admin atau Owner yang dapat mengubah role pengguna.';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_guard_profile_role_change
  before update on public.profiles
  for each row execute function public.guard_profile_role_change();
