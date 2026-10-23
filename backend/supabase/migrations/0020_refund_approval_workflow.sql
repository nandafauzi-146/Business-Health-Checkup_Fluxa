create or replace function public.approve_sale_refund_request(
  p_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_request public.refund_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Akses tidak diizinkan.';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id;

  if not found
    or v_profile.approval_status is distinct from 'approved'
    or v_profile.role not in ('admin', 'owner') then
    raise exception 'Akses tidak diizinkan.';
  end if;

  select * into v_request
  from public.refund_requests
  where id = p_request_id
  for update;

  if not found or v_request.status <> 'pending' then
    raise exception 'Pengajuan tidak ditemukan atau sudah diproses.';
  end if;

  perform public.void_sale(v_request.sale_id, v_request.reason);

  update public.refund_requests
  set status = 'approved',
      reviewed_by = v_user_id,
      reviewed_at = now()
  where id = p_request_id;

  return true;
end;
$$;

revoke all on function public.approve_sale_refund_request(uuid) from public, anon;
grant execute on function public.approve_sale_refund_request(uuid) to authenticated;

notify pgrst, 'reload schema';
