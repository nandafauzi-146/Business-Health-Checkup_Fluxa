-- ==============================================================================
-- 0017_add_email_to_profiles.sql
-- Menambahkan kolom email ke tabel public.profiles dan menyinkronkan
-- dari tabel auth.users agar email terlihat jelas di Table Editor & profil.
-- ==============================================================================

-- 1. Tambah kolom email ke public.profiles jika belum ada
alter table if exists public.profiles
  add column if not exists email text;

-- 2. Sinkronkan email dari auth.users untuk profil yang sudah ada
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and (p.email is null or p.email = '');

-- 3. Perbarui trigger handle_new_user agar selalu menyimpan email ke profiles
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

  insert into public.profiles (id, full_name, role, phone, email)
  values (new.id, v_name, v_role, new.raw_user_meta_data->>'phone', new.email)
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      phone = excluded.phone,
      email = excluded.email;

  return new;
end;
$$;

comment on column public.profiles.email is 'Alamat email akun login (disinkronkan dari auth.users)';
