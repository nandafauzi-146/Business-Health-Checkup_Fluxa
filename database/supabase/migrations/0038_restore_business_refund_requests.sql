create or replace function public.request_sale_refund(
  p_sale_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid := public.current_business_id();
  v_sale public.sales%rowtype;
  v_request_id uuid;
begin
  if v_user_id is null or public.current_role() is distinct from 'kasir' then
    raise exception 'Hanya Kasir yang disetujui dapat mengajukan refund.';
  end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 or char_length(trim(p_reason)) > 500 then
    raise exception 'Alasan refund harus berisi 3 sampai 500 karakter.';
  end if;

  select * into v_sale
  from public.sales
  where id = p_sale_id
    and cashier_id = v_user_id
    and business_id = v_business_id
  for update;
  if not found then
    raise exception 'Transaksi tidak ditemukan atau bukan milik Anda.';
  end if;
  if v_sale.status <> 'completed' then
    raise exception 'Hanya transaksi selesai yang dapat diajukan refund.';
  end if;
  if exists (
    select 1 from public.refund_requests
    where sale_id = p_sale_id and status = 'pending'
  ) then
    raise exception 'Sudah ada pengajuan refund yang menunggu persetujuan untuk transaksi ini.';
  end if;

  insert into public.refund_requests (sale_id, business_id, requested_by, reason, status)
  values (p_sale_id, v_sale.business_id, v_user_id, trim(p_reason), 'pending')
  returning id into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function public.request_sale_refund(uuid, text) from public, anon;
grant execute on function public.request_sale_refund(uuid, text) to authenticated;

notify pgrst, 'reload schema';
