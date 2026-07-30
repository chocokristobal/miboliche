-- MI BOLICHE · CORRECCIÓN DEL LISTADO DE NEGOCIOS DEL PANEL
-- Ejecutar completo en Supabase SQL Editor.
-- Es repetible y no elimina usuarios, negocios, ventas ni inventario.

begin;

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
language sql
stable
security definer
set search_path = public, auth
as $function$
  select
    b.id::uuid,
    coalesce(b.name, 'Negocio sin nombre')::text,
    coalesce(p.full_name, '')::text,
    coalesce(u.email::text, '')::text,
    coalesce(bp.rut, '')::text,
    coalesce(bp.phone, '')::text,
    coalesce(bp.address, '')::text,
    coalesce(bp.commune, '')::text,
    coalesce(bp.region, '')::text,
    coalesce(bp.business_type, 'Minimarket')::text,
    coalesce(ba.plan_name, 'Prueba gratuita')::text,
    coalesce(ba.monthly_fee, 0)::numeric,
    coalesce(ba.payment_state, 'paid')::text,
    coalesce(public.account_effective_status(b.id), ba.account_status, 'trialing')::text,
    ba.due_date::date,
    ba.grace_ends_at::date,
    ba.last_payment::date,
    coalesce(u.created_at, b.created_at)::timestamptz,
    (
      select count(distinct member_id)
      from (
        select b.owner_id as member_id
        union
        select bm.user_id
        from public.business_members bm
        where bm.business_id = b.id
      ) members
      where member_id is not null
    )::bigint,
    (
      select count(*)
      from public.products pr
      where pr.business_id = b.id
        and pr.active = true
    )::bigint,
    (
      select count(*)
      from public.sales s
      where s.business_id = b.id
        and s.status = 'completed'
    )::bigint,
    (
      select coalesce(sum(s.total_amount), 0)
      from public.sales s
      where s.business_id = b.id
        and s.status = 'completed'
    )::numeric,
    (
      select max(s.sold_at)
      from public.sales s
      where s.business_id = b.id
        and s.status = 'completed'
    )::timestamptz,
    coalesce(ba.notes, '')::text
  from public.businesses b
  left join public.business_profiles bp on bp.business_id = b.id
  left join public.business_accounts ba on ba.business_id = b.id
  left join public.profiles p on p.id = b.owner_id
  left join auth.users u on u.id = b.owner_id
  where public.is_platform_admin()
  order by coalesce(u.created_at, b.created_at) desc, b.name;
$function$;

revoke all on function public.admin_list_businesses() from public;
grant execute on function public.admin_list_businesses() to authenticated;

notify pgrst, 'reload schema';
commit;

select
  to_regprocedure('public.admin_list_businesses()') is not null
    as listado_corregido,
  has_function_privilege(
    'authenticated',
    'public.admin_list_businesses()',
    'EXECUTE'
  ) as panel_habilitado,
  (
    select count(*) >= 1
    from public.businesses
  ) as negocio_registrado;
