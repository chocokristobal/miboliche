-- MI BOLICHE · CAJA, ANULACIONES Y AJUSTES DE INVENTARIO
-- Ejecutar el archivo completo en Supabase SQL Editor.
-- Es repetible: puede volver a ejecutarse sin duplicar tablas, funciones o políticas.

begin;

alter table public.sales
  add column if not exists void_reason text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid;

create table if not exists public.cash_closures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  business_date date not null,
  opening_cash numeric(14,2) not null default 0 check (opening_cash >= 0),
  cash_sales numeric(14,2) not null default 0 check (cash_sales >= 0),
  other_cash_in numeric(14,2) not null default 0 check (other_cash_in >= 0),
  cash_out numeric(14,2) not null default 0 check (cash_out >= 0),
  expected_cash numeric(14,2) not null,
  counted_cash numeric(14,2) not null check (counted_cash >= 0),
  difference numeric(14,2) not null,
  note text,
  closed_by uuid not null,
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, business_date)
);

create index if not exists cash_closures_business_date_idx
  on public.cash_closures (business_id, business_date desc);

alter table public.cash_closures enable row level security;

drop policy if exists "business members read cash closures" on public.cash_closures;
create policy "business members read cash closures"
  on public.cash_closures
  for select
  to authenticated
  using (public.is_business_writable(business_id));

revoke all on table public.cash_closures from public;
grant select on table public.cash_closures to authenticated;

create or replace function public.adjust_inventory_stock(
  p_business_id uuid,
  p_product_id uuid,
  p_new_stock numeric,
  p_reason text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_current_stock numeric(12,3);
  v_difference numeric(12,3);
  v_movement_type text;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not public.is_business_writable(p_business_id) then
    raise exception 'El negocio no está habilitado para ajustar inventario';
  end if;

  if p_new_stock < 0 then
    raise exception 'El stock final no puede ser negativo';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'Debes indicar el motivo del ajuste';
  end if;

  select current_stock
  into v_current_stock
  from public.products
  where id = p_product_id
    and business_id = p_business_id
    and active = true
  for update;

  if not found then
    raise exception 'Producto no encontrado en este negocio';
  end if;

  v_difference := p_new_stock - v_current_stock;

  if v_difference = 0 then
    return v_current_stock;
  end if;

  v_movement_type := case
    when v_difference > 0 then 'adjustment_in'
    else 'adjustment_out'
  end;

  insert into public.inventory_movements (
    business_id,
    product_id,
    movement_type,
    quantity,
    reason,
    created_by
  )
  values (
    p_business_id,
    p_product_id,
    v_movement_type,
    abs(v_difference),
    trim(p_reason),
    v_user_id
  );

  return p_new_stock;
end;
$function$;

create or replace function public.void_sale(
  p_business_id uuid,
  p_sale_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_sale public.sales%rowtype;
  v_item record;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not public.is_business_writable(p_business_id) then
    raise exception 'El negocio no está habilitado para anular ventas';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'Debes indicar el motivo de la anulación';
  end if;

  select *
  into v_sale
  from public.sales
  where id = p_sale_id
    and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Venta no encontrada en este negocio';
  end if;

  if v_sale.status = 'voided' then
    raise exception 'Esta venta ya está anulada';
  end if;

  for v_item in
    select product_id, sum(quantity) as quantity
    from public.sale_items
    where sale_id = p_sale_id
    group by product_id
    order by product_id
  loop
    perform 1
    from public.products
    where id = v_item.product_id
      and business_id = p_business_id
    for update;

    if not found then
      raise exception 'No se encontró un producto asociado a la venta';
    end if;

    insert into public.inventory_movements (
      business_id,
      product_id,
      reference_sale_id,
      movement_type,
      quantity,
      reason,
      created_by
    )
    values (
      p_business_id,
      v_item.product_id,
      p_sale_id,
      'adjustment_in',
      v_item.quantity,
      'Anulación de venta: ' || trim(p_reason),
      v_user_id
    );
  end loop;

  update public.sales
  set status = 'voided',
      void_reason = trim(p_reason),
      voided_at = now(),
      voided_by = v_user_id
  where id = p_sale_id;

  return p_sale_id;
end;
$function$;

create or replace function public.close_cash_day(
  p_business_id uuid,
  p_business_date date,
  p_opening_cash numeric,
  p_other_cash_in numeric,
  p_cash_out numeric,
  p_counted_cash numeric,
  p_note text default ''
)
returns public.cash_closures
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_cash_sales numeric(14,2);
  v_expected numeric(14,2);
  v_result public.cash_closures;
  v_day_start timestamptz;
  v_day_end timestamptz;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not public.is_business_writable(p_business_id) then
    raise exception 'El negocio no está habilitado para cerrar caja';
  end if;

  if p_business_date > (now() at time zone 'America/Santiago')::date then
    raise exception 'No puedes cerrar una fecha futura';
  end if;

  if least(p_opening_cash, p_other_cash_in, p_cash_out, p_counted_cash) < 0 then
    raise exception 'Los montos de caja no pueden ser negativos';
  end if;

  v_day_start := p_business_date::timestamp at time zone 'America/Santiago';
  v_day_end := (p_business_date + 1)::timestamp at time zone 'America/Santiago';

  select coalesce(sum(total_amount), 0)
  into v_cash_sales
  from public.sales
  where business_id = p_business_id
    and payment_method = 'cash'
    and status = 'completed'
    and sold_at >= v_day_start
    and sold_at < v_day_end;

  v_expected := p_opening_cash + v_cash_sales + p_other_cash_in - p_cash_out;

  if v_expected < 0 then
    raise exception 'Los retiros no pueden superar el efectivo disponible';
  end if;

  insert into public.cash_closures (
    business_id,
    business_date,
    opening_cash,
    cash_sales,
    other_cash_in,
    cash_out,
    expected_cash,
    counted_cash,
    difference,
    note,
    closed_by,
    closed_at,
    updated_at
  )
  values (
    p_business_id,
    p_business_date,
    p_opening_cash,
    v_cash_sales,
    p_other_cash_in,
    p_cash_out,
    v_expected,
    p_counted_cash,
    p_counted_cash - v_expected,
    nullif(trim(p_note), ''),
    v_user_id,
    now(),
    now()
  )
  on conflict (business_id, business_date)
  do update set
    opening_cash = excluded.opening_cash,
    cash_sales = excluded.cash_sales,
    other_cash_in = excluded.other_cash_in,
    cash_out = excluded.cash_out,
    expected_cash = excluded.expected_cash,
    counted_cash = excluded.counted_cash,
    difference = excluded.difference,
    note = excluded.note,
    closed_by = excluded.closed_by,
    closed_at = excluded.closed_at,
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$function$;

revoke all on function public.adjust_inventory_stock(uuid, uuid, numeric, text) from public;
revoke all on function public.void_sale(uuid, uuid, text) from public;
revoke all on function public.close_cash_day(uuid, date, numeric, numeric, numeric, numeric, text) from public;

grant execute on function public.adjust_inventory_stock(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.void_sale(uuid, uuid, text) to authenticated;
grant execute on function public.close_cash_day(uuid, date, numeric, numeric, numeric, numeric, text) to authenticated;

notify pgrst, 'reload schema';

commit;

select
  to_regclass('public.cash_closures') is not null as tabla_cierres,
  to_regprocedure('public.adjust_inventory_stock(uuid,uuid,numeric,text)') is not null as ajuste_inventario,
  to_regprocedure('public.void_sale(uuid,uuid,text)') is not null as anulacion_venta,
  to_regprocedure('public.close_cash_day(uuid,date,numeric,numeric,numeric,numeric,text)') is not null as cierre_caja;
