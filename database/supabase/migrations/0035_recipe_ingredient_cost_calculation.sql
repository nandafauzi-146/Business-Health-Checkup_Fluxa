-- Preserve the existing signature; density is ignored by the universal 1 ml = 1 g rule.
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
    return v_in_base / v_to_mult;
  end if;

  if v_from_dim = 'weight' and v_to_dim = 'volume' then
    v_in_base := p_qty * v_from_mult;
    return v_in_base / v_to_mult;
  end if;

  if v_from_dim = 'volume' and v_to_dim = 'weight' then
    v_in_base := p_qty * v_from_mult;
    return v_in_base / v_to_mult;
  end if;

  return p_qty;
end;
$$;

create or replace function public.calculate_recipe_ingredient_costs(p_ingredients jsonb)
returns table (
  ingredient_index integer,
  raw_material_id uuid,
  normalized_quantity numeric,
  ingredient_cost numeric
)
language plpgsql
stable
as $$
declare
  v_item jsonb;
  v_ingredient_index integer;
  v_material_id uuid;
  v_quantity numeric;
  v_recipe_unit text;
  v_material_unit text;
  v_material_cost numeric;
  v_recipe_group text;
  v_material_group text;
  v_normalized_quantity numeric;
begin
  if p_ingredients is null or jsonb_typeof(p_ingredients) <> 'array' then
    raise exception 'Recipe ingredients must be an array.';
  end if;

  for v_item, v_ingredient_index in
    select item.value, item.ordinality::integer
    from jsonb_array_elements(p_ingredients) with ordinality as item(value, ordinality)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Each recipe ingredient must be an object.';
    end if;

    v_material_id := (v_item ->> 'raw_material_id')::uuid;
    v_quantity := nullif(v_item ->> 'quantity', '')::numeric;
    v_recipe_unit := lower(trim(coalesce(v_item ->> 'unit', '')));

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Recipe ingredient quantities must be greater than zero.';
    end if;

    select lower(trim(rm.unit)), rm.cost_per_unit
    into v_material_unit, v_material_cost
    from public.raw_materials as rm
    where rm.id = v_material_id;

    if not found then
      raise exception 'Recipe ingredient material was not found or is inaccessible.';
    end if;

    v_recipe_group := case
      when v_recipe_unit in ('g', 'gram', 'gr', 'kg', 'kilogram', 'ml', 'mililiter', 'milliliter', 'l', 'liter', 'ltr') then 'mass_volume'
      when v_recipe_unit in ('pcs', 'piece', 'pieces', 'butir', 'buah', 'biji') then 'pieces'
      when v_recipe_unit = 'porsi' then 'porsi'
      else null
    end;
    v_material_group := case
      when v_material_unit in ('g', 'gram', 'gr', 'kg', 'kilogram', 'ml', 'mililiter', 'milliliter', 'l', 'liter', 'ltr') then 'mass_volume'
      when v_material_unit in ('pcs', 'piece', 'pieces', 'butir', 'buah', 'biji') then 'pieces'
      when v_material_unit = 'porsi' then 'porsi'
      else null
    end;

    if v_recipe_group is null or v_material_group is null or v_recipe_group <> v_material_group then
      raise exception 'Recipe ingredient units are invalid or incompatible with the stock unit.';
    end if;

    v_normalized_quantity := public.convert_ingredient_unit(
      v_quantity,
      v_recipe_unit,
      v_material_unit
    );

    return query
      select
        v_ingredient_index,
        v_material_id,
        v_normalized_quantity,
        v_normalized_quantity * v_material_cost;
  end loop;
end;
$$;

revoke all on function public.convert_ingredient_unit(numeric, text, text, numeric) from public, anon;
grant execute on function public.convert_ingredient_unit(numeric, text, text, numeric) to authenticated;

revoke all on function public.calculate_recipe_ingredient_costs(jsonb) from public, anon;
grant execute on function public.calculate_recipe_ingredient_costs(jsonb) to authenticated;
