-- Keep the existing parameter for compatibility with stored procedures, but
-- always use the universal 1 ml = 1 g conversion rule.
create or replace function public.convert_ingredient_unit(
  p_qty numeric,
  p_from_unit text,
  p_to_unit text,
  p_density numeric default 1.0
)
returns numeric
language plpgsql
immutable
as $$
declare
  v_from text := lower(trim(coalesce(p_from_unit, 'g')));
  v_to text := lower(trim(coalesce(p_to_unit, 'g')));
  v_from_dim text;
  v_to_dim text;
  v_from_mult numeric := 1.0;
  v_to_mult numeric := 1.0;
  v_in_base numeric;
begin
  if p_qty is null or p_qty = 0 or v_from = v_to then
    return coalesce(p_qty, 0);
  end if;

  if v_from in ('g', 'gram', 'gr') then
    v_from_dim := 'weight'; v_from_mult := 1.0;
  elsif v_from in ('kg', 'kilogram') then
    v_from_dim := 'weight'; v_from_mult := 1000.0;
  elsif v_from in ('ml', 'mililiter', 'milliliter') then
    v_from_dim := 'volume'; v_from_mult := 1.0;
  elsif v_from in ('l', 'liter', 'ltr') then
    v_from_dim := 'volume'; v_from_mult := 1000.0;
  else
    v_from_dim := 'other'; v_from_mult := 1.0;
  end if;

  if v_to in ('g', 'gram', 'gr') then
    v_to_dim := 'weight'; v_to_mult := 1.0;
  elsif v_to in ('kg', 'kilogram') then
    v_to_dim := 'weight'; v_to_mult := 1000.0;
  elsif v_to in ('ml', 'mililiter', 'milliliter') then
    v_to_dim := 'volume'; v_to_mult := 1.0;
  elsif v_to in ('l', 'liter', 'ltr') then
    v_to_dim := 'volume'; v_to_mult := 1000.0;
  else
    v_to_dim := 'other'; v_to_mult := 1.0;
  end if;

  if v_from_dim = v_to_dim then
    v_in_base := p_qty * v_from_mult;
    return round((v_in_base / v_to_mult)::numeric, 4);
  end if;

  if v_from_dim = 'weight' and v_to_dim = 'volume' then
    v_in_base := p_qty * v_from_mult;
    return round((v_in_base / v_to_mult)::numeric, 4);
  end if;

  if v_from_dim = 'volume' and v_to_dim = 'weight' then
    v_in_base := p_qty * v_from_mult;
    return round((v_in_base / v_to_mult)::numeric, 4);
  end if;

  return p_qty;
end;
$$;
