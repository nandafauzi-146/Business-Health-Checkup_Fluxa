-- Migration 0029 replaced this RPC with an obsolete receivables implementation.
-- Restore the supplier_payables contract used by the debt and receivables UI.
-- Recover promotions created after tenant isolation without a business_id.
update public.promotions promo
set business_id = coalesce(
  (select p.business_id from public.profiles p where p.id = promo.created_by),
  (select b.id from public.businesses b order by b.created_at asc limit 1)
)
where promo.business_id is null;

drop function if exists public.record_business_debt_payment(uuid, integer, text, text);

create function public.record_business_debt_payment(
  p_payable_id uuid,
  p_amount integer,
  p_payment_method text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid := public.current_business_id();
  v_payable public.supplier_payables%rowtype;
  v_new_paid integer;
  v_new_status text;
begin
  if v_user_id is null or not public.is_admin_or_owner() then
    raise exception 'Hanya Admin atau Owner yang disetujui dapat mencatat pembayaran.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal pembayaran harus lebih dari nol.';
  end if;
  if p_payment_method not in ('cash', 'non_cash') then
    raise exception 'Metode pembayaran tidak valid.';
  end if;

  select * into v_payable
  from public.supplier_payables
  where id = p_payable_id
    and business_id = v_business_id
  for update;
  if not found then
    raise exception 'Data hutang atau piutang tidak ditemukan.';
  end if;
  if v_payable.status = 'paid' or p_amount > (v_payable.total_amount - v_payable.paid_amount) then
    raise exception 'Nominal melebihi sisa tagihan atau tagihan sudah lunas.';
  end if;

  v_new_paid := v_payable.paid_amount + p_amount;
  v_new_status := case when v_new_paid = v_payable.total_amount then 'paid' else 'partial' end;

  insert into public.supplier_payments (
    supplier_payable_id, business_id, amount, payment_method, note, created_by
  ) values (
    p_payable_id, v_payable.business_id, p_amount, p_payment_method, p_note, v_user_id
  );

  update public.supplier_payables
  set paid_amount = v_new_paid,
      status = v_new_status
  where id = p_payable_id;

  return jsonb_build_object(
    'paid_amount', v_new_paid,
    'remaining_amount', v_payable.total_amount - v_new_paid,
    'status', v_new_status
  );
end;
$$;

revoke all on function public.record_business_debt_payment(uuid, integer, text, text) from public, anon;
grant execute on function public.record_business_debt_payment(uuid, integer, text, text) to authenticated;

notify pgrst, 'reload schema';
