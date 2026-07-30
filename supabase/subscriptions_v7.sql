-- MI BOLICHE · PLANES, VENCIMIENTOS, GRACIA, SUSPENSIÓN Y REACTIVACIÓN
-- Ejecutar completo en Supabase SQL Editor. Es repetible y no elimina datos.

begin;

alter table public.business_accounts
  add column if not exists grace_ends_at date;

update public.business_accounts
set grace_ends_at = coalesce(grace_ends_at, due_date + 5)
where due_date is not null;

create or replace function public.account_effective_status(p_business_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $function$
  select case
    when ba.account_status in ('canceled', 'archived') then ba.account_status
    when ba.account_status = 'trialing' and ba.trial_ends_at is not null and current_date > ba.trial_ends_at then 'suspended'
    when ba.payment_state = 'paid' then
      case when ba.account_status in ('suspended', 'past_due', 'grace_period') then 'active' else ba.account_status end
    when ba.due_date is not null and current_date > coalesce(ba.grace_ends_at, ba.due_date + 5) then 'suspended'
    when ba.due_date is not null and current_date > ba.due_date then 'grace_period'
    else ba.account_status
  end
  from public.business_accounts ba
  where ba.business_id = p_business_id;
$function$;

-- Conserva el nombre histórico del parámetro instalado en este proyecto.
create or replace function public.is_business_writable(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select
    public.can_access_business($1)
    and coalesce(public.account_effective_status($1) not in ('suspended', 'canceled', 'archived'), true);
$function$;

create or replace function public.admin_manage_subscription(
  p_business_id uuid,
  p_plan_name text,
  p_monthly_fee numeric,
  p_account_status text,
  p_payment_state text,
  p_due_date date,
  p_last_payment date,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_status text;
begin
  if not public.is_platform_admin() then
    raise exception 'Acceso exclusivo para administración';
  end if;

  if nullif(trim(p_plan_name), '') is null then
    raise exception 'Debes indicar un plan';
  end if;
  if p_monthly_fee is null or p_monthly_fee < 0 then
    raise exception 'El valor mensual no puede ser negativo';
  end if;
  if p_account_status not in ('trialing', 'active', 'past_due', 'grace_period', 'suspended', 'canceled', 'archived') then
    raise exception 'Estado de cuenta inválido';
  end if;
  if p_payment_state not in ('paid', 'late', 'unpaid') then
    raise exception 'Estado de pago inválido';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Debes indicar el motivo del cambio';
  end if;

  v_status := case
    when p_payment_state = 'paid' and p_account_status in ('suspended', 'past_due', 'grace_period') then 'active'
    else p_account_status
  end;

  insert into public.business_accounts (
    business_id, plan_name, monthly_fee, payment_state, account_status,
    due_date, grace_ends_at, last_payment, updated_by, updated_at
  )
  values (
    p_business_id, trim(p_plan_name), p_monthly_fee, p_payment_state, v_status,
    p_due_date, case when p_due_date is null then null else p_due_date + 5 end,
    p_last_payment, auth.uid(), now()
  )
  on conflict (business_id) do update set
    plan_name = excluded.plan_name,
    monthly_fee = excluded.monthly_fee,
    payment_state = excluded.payment_state,
    account_status = excluded.account_status,
    due_date = excluded.due_date,
    grace_ends_at = excluded.grace_ends_at,
    last_payment = excluded.last_payment,
    updated_by = excluded.updated_by,
    updated_at = now();

  insert into public.admin_audit_log (admin_user_id, business_id, action, detail)
  values (
    auth.uid(),
    p_business_id,
    'Actualización de suscripción',
    format(
      'Plan: %s · Monto: %s · Cuenta: %s · Pago: %s · Vence: %s · Motivo: %s',
      trim(p_plan_name), p_monthly_fee, v_status, p_payment_state,
      coalesce(p_due_date::text, 'sin fecha'), trim(p_reason)
    )
  );
end;
$function$;

drop function if exists public.admin_list_businesses();

create function public.admin_list_businesses()
returns table (
  business_id uuid,
  business_name text,
  owner_name text,
  owner_email text,
  rut text,
  phone text,
  address text,
  commune text,
  region text,
  business_type text,
  plan_name text,
  monthly_fee numeric,
  payment_state text,
  account_status text,
  due_date date,
  grace_ends_at date,
  last_payment date,
  registered_at timestamptz,
  user_count bigint,
  product_count bigint,
  sale_count bigint,
  sales_volume numeric,
  last_sale_at timestamptz,
  notes text
)
language plpgsql
security definer
set search_path = public, auth
as $function$
begin
  if not public.is_platform_admin() then
    raise exception 'Acceso exclusivo para administración';
  end if;

  return query
  select
    b.id,
    b.name,
    coalesce(p.full_name, ''),
    coalesce(u.email::text, ''),
    coalesce(bp.rut, ''),
    coalesce(bp.phone, ''),
    coalesce(bp.address, ''),
    coalesce(bp.commune, ''),
    coalesce(bp.region, ''),
    coalesce(bp.business_type, 'Minimarket'),
    coalesce(ba.plan_name, 'Prueba gratuita'),
    coalesce(ba.monthly_fee, 0),
    coalesce(ba.payment_state, 'paid'),
    coalesce(public.account_effective_status(b.id), 'trialing'),
    ba.due_date,
    ba.grace_ends_at,
    ba.last_payment,
    u.created_at,
    (select count(*) + 1 from public.business_members bm where bm.business_id = b.id),
    (select count(*) from public.products pr where pr.business_id = b.id and pr.active = true),
    (select count(*) from public.sales s where s.business_id = b.id and s.status = 'completed'),
    (select coalesce(sum(s.total_amount), 0) from public.sales s where s.business_id = b.id and s.status = 'completed'),
    (select max(s.sold_at) from public.sales s where s.business_id = b.id and s.status = 'completed'),
    coalesce(ba.notes, '')
  from public.businesses b
  left join public.business_profiles bp on bp.business_id = b.id
  left join public.business_accounts ba on ba.business_id = b.id
  left join public.profiles p on p.id = b.owner_id
  left join auth.users u on u.id = b.owner_id
  order by u.created_at desc nulls last, b.name;
end;
$function$;

revoke all on function public.account_effective_status(uuid) from public;
revoke all on function public.admin_manage_subscription(uuid,text,numeric,text,text,date,date,text) from public;
revoke all on function public.admin_list_businesses() from public;
grant execute on function public.account_effective_status(uuid) to authenticated;
grant execute on function public.admin_manage_subscription(uuid,text,numeric,text,text,date,date,text) to authenticated;
grant execute on function public.admin_list_businesses() to authenticated;

commit;

select
  to_regprocedure('public.admin_manage_subscription(uuid,text,numeric,text,text,date,date,text)') is not null as gestion_suscripcion,
  to_regprocedure('public.account_effective_status(uuid)') is not null as vencimiento_automatico,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'business_accounts' and column_name = 'grace_ends_at'
  ) as periodo_gracia,
  to_regprocedure('public.is_business_writable(uuid)') is not null as bloqueo_y_reactivacion;
