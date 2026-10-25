-- ==============================================================================
-- 0026_landing_cms.sql
-- Tabel penyimpan konten dinamis Landing Page (CMS) yang dikelola oleh Super Admin.
-- ==============================================================================

create table if not exists public.landing_cms_content (
  id text primary key default 'default',
  content jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.landing_cms_content enable row level security;

-- Publik (termasuk anon & authenticated) dapat membaca konten CMS landing page
drop policy if exists "Landing CMS is readable by everyone" on public.landing_cms_content;
create policy "Landing CMS is readable by everyone"
  on public.landing_cms_content for select to public
  using (true);

-- Hanya Super Admin yang dapat mengubah konten CMS
drop policy if exists "Super admins manage landing CMS" on public.landing_cms_content;
create policy "Super admins manage landing CMS"
  on public.landing_cms_content for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

grant select on public.landing_cms_content to anon, authenticated;
grant all on public.landing_cms_content to service_role;
