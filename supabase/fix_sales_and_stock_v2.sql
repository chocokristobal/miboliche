-- MI BOLICHE · CORRECCIÓN DEFINITIVA DE VENTAS E INVENTARIO
-- Ejecutar completo una sola vez en Supabase SQL Editor.
--
-- La base ya tiene esta cadena automática:
-- sale_items -> inventory_movements -> products.current_stock
--
-- Esta función solo crea la venta y sus detalles. No descuenta stock
-- directamente y no crea movimientos manuales, evitando descuentos duplicados.

begin;

-- Detenerse si falta alguno de los dos triggers responsables del inventario.
do $preflight$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'sale_items'
      and t.tgname = 'sale_item_decreases_stock'
      and not t.tgisinternal
      and t.tgenabled <> 'D'
  ) then
    raise exception 'Falta el trigger sale_item_decreases_stock';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'inventory_movements'
      and t.tgname = 'inventory_movement_updates_stock'
      and not t.tgisinternal
      and t.tgenabled <> 'D'
  ) then
    raise exception 'Falta el trigger inventory_movement_updates_stock';
  end if;
end;
$preflight$;

-- Se elimina la firma exacta para impedir que sobreviva una versión anterior.
drop function if exists public.register_sale(uuid, text, jsonb);

create function public.register_sale(
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
  v_function_version constant text := 'mb_sale_v2_20260729';
  v_user_id uuid := auth.uid();
  v_sale_id uuid;
  v_subtotal integer := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_constraint_name text;
  v_error_detail text;
begin
  if v_function_version is null then
    raise exception 'Versión de función inválida';
  end if;

  if v_user_id is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not public.is_business_writable(p_business_id) then
    raise exception 'El negocio no está habilitado para registrar ventas';
  end if;

  if p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'Medio de pago inválido';
  end if;

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe incluir al menos un producto';
  end if;

  -- Agrupar el mismo producto antes de bloquear y validar su stock.
  for v_item in
    select jsonb_build_object(
      'product_id', parsed.product_id,
      'quantity', sum(parsed.quantity)
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

  -- Insertar solo los detalles. Los triggers existentes hacen un único
  -- movimiento de salida y un único descuento de stock.
  for v_item in
    select jsonb_build_object(
      'product_id', parsed.product_id,
      'quantity', sum(parsed.quantity)
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
      and business_id = p_business_id;

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

-- Pedir a la API de Supabase que reconozca inmediatamente la función reemplazada.
notify pgrst, 'reload schema';

commit;

-- VERIFICACIÓN AUTOMÁTICA
-- El resultado correcto es:
-- version_v2 = true | descuento_directo = false
-- movimiento_manual = false | agrupa_productos = true
with funcion as (
  select lower(
    pg_get_functiondef(
      'public.register_sale(uuid,text,jsonb)'::regprocedure
    )
  ) as codigo
)
select
  codigo like '%mb_sale_v2_20260729%' as version_v2,
  codigo like '%update public.products%' as descuento_directo,
  codigo like '%insert into public.inventory_movements%' as movimiento_manual,
  codigo like '%group by parsed.product_id%' as agrupa_productos
from funcion;
