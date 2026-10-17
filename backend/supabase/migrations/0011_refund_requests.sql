-- 0011_refund_requests.sql
-- Tabel pengajuan refund/void dari kasir yang membutuhkan persetujuan admin.
-- Alur: kasir submit → status 'pending' → admin approve/reject → jika approved, sistem eksekusi void.

create table if not exists public.refund_requests (
  id            uuid        primary key default gen_random_uuid(),
  sale_id       uuid        not null references public.sales(id) on delete cascade,
  requested_by  uuid        not null references public.profiles(id),  -- kasir pengaju
  reason        text        not null,
  status        text        not null default 'pending'
                            check (status in ('pending', 'approved', 'rejected')),
  reviewed_by   uuid        references public.profiles(id),           -- admin/owner yang memproses
  reviewed_at   timestamptz,
  reject_note   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index agar query pending cepat
create index if not exists idx_refund_requests_status
  on public.refund_requests(status);

create index if not exists idx_refund_requests_sale_id
  on public.refund_requests(sale_id);

-- Trigger updated_at otomatis
create trigger trg_refund_requests_updated_at
  before update on public.refund_requests
  for each row execute procedure public.set_updated_at();

-- RLS
alter table public.refund_requests enable row level security;

-- Kasir: bisa INSERT pengajuan & SELECT pengajuan milik sendiri
create policy "kasir_insert_refund_request"
  on public.refund_requests for insert
  to authenticated
  with check (public.current_role() = 'kasir' and requested_by = auth.uid());

create policy "kasir_select_own_refund_request"
  on public.refund_requests for select
  to authenticated
  using (public.current_role() = 'kasir' and requested_by = auth.uid());

-- Admin & Owner: bisa SELECT semua & UPDATE (untuk approve/reject)
create policy "admin_owner_select_refund_requests"
  on public.refund_requests for select
  to authenticated
  using (public.is_admin_or_owner());

create policy "admin_owner_update_refund_requests"
  on public.refund_requests for update
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());
