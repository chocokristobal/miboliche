-- Run once in Supabase SQL Editor.
-- Creates an atomic sale: sale header and items.
-- Existing database triggers perform the stock change exactly once:
-- sale_items -> inventory_movements -> products.current_stock.

create or replace function public.register_sale(
  p_business_id uuid,
  p_payment_method text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_sale_id uuid;
  v_subtotal integer;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_constraint_name text;
  v_error_detail text;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not public.is_business_writable(p_business_id) then
    raise exception 'El negocio no está habilitado para registrar ventas';
  end if;

  if p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'Medio de pago inválido';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe incluir al menos un producto';
  end if;

  v_subtotal := 0;

  -- Combine repeated entries for the same product before checking stock.
  -- This prevents two cart rows from each validating against the same
  -- pre-sale stock and later driving the product below zero.
  for v_item in
    select jsonb_build_object(
      'product_id',
      parsed.product_id,
      'quantity',
      sum(parsed.quantity)
    )
    from (
      select
        (entry.value ->> 'product_id')::uuid as product_id,
        (entry.value ->> 'quantity')::integer as quantity
      from jsonb_array_elements(p_items) as entry(value)
    ) as parsed
    group by parsed.product_id
    order by parsed.product_id
  loop
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor que cero';
    end if;

    select *
    into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
      and business_id = p_business_id
      and active = true
    for update;

    if not found then
      raise exception 'Producto no encontrado en este negocio';
    end if;

    if v_product.current_stock < v_quantity then
      raise exception 'Stock insuficiente para %', v_product.name;
    end if;

    v_subtotal := v_subtotal + (v_product.sale_price * v_quantity);
  end loop;

  insert into public.sales (
    business_id,
    created_by,
    payment_method,
    subtotal,
    discount,
    total_amount,
    sold_at,
    status
  )
  values (
    p_business_id,
    v_user_id,
    p_payment_method,
    v_subtotal,
    0,
    v_subtotal,
    now(),
    'completed'
  )
  returning id into v_sale_id;

  for v_item in
    select jsonb_build_object(
      'product_id',
      parsed.product_id,
      'quantity',
      sum(parsed.quantity)
    )
    from (
      select
        (entry.value ->> 'product_id')::uuid as product_id,
        (entry.value ->> 'quantity')::integer as quantity
      from jsonb_array_elements(p_items) as entry(value)
    ) as parsed
    group by parsed.product_id
    order by parsed.product_id
  loop
    v_quantity := (v_item ->> 'quantity')::integer;

    select *
    into v_product
    from public.products
    where id = (v_item ->> 'product_id')::uuid
      and business_id = p_business_id
    for update;

    insert into public.sale_items (
      sale_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      unit_cost,
      subtotal
    )
    values (
      v_sale_id,
      v_product.id,
      v_product.name,
      v_quantity,
      v_product.sale_price,
      v_product.purchase_price,
      v_product.sale_price * v_quantity
    );

  end loop;

  return v_sale_id;
exception
  when check_violation then
    get stacked diagnostics
      v_constraint_name = constraint_name,
      v_error_detail = pg_exception_detail;

    raise exception using
      errcode = 'P0001',
      message = format(
        'La venta fue rechazada por la regla de integridad %s.',
        coalesce(nullif(v_constraint_name, ''), 'desconocida')
      ),
      detail = v_error_detail;
end;
$function$;

revoke all on function public.register_sale(uuid, text, jsonb) from public;
grant execute on function public.register_sale(uuid, text, jsonb) to authenticated;
