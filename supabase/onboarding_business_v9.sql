-- MI BOLICHE · ALTA AUTOMÁTICA Y VINCULACIÓN DEL NEGOCIO
-- Ejecutar completo en Supabase SQL Editor.
-- Es repetible y no elimina usuarios, negocios ni información operacional.

begin;

create or replace function public.ensure_current_user_business()
returns table (
  business_id uuid,
  business_name text,
  created_now boolean
)
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_business_name text;
  v_full_name text;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if public.is_platform_admin() then
    return;
  end if;

  select b.id, b.name
  into v_business_id, v_business_name
  from public.businesses b
  where b.owner_id = v_user_id
  order by b.created_at
  limit 1;

  if v_business_id is not null then
    return query select v_business_id, v_business_name, false;
    return;
  end if;

  select b.id, b.name
  into v_business_id, v_business_name
  from public.business_members bm
  join public.businesses b on b.id = bm.business_id
  where bm.user_id = v_user_id
  order by b.created_at
  limit 1;

  if v_business_id is not null then
    return query select v_business_id, v_business_name, false;
    return;
  end if;

  select
    coalesce(nullif(trim(u.raw_user_meta_data ->> 'business_name'), ''), 'Mi negocio'),
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(u.email, 'Usuario'), '@', 1)
    )
  into v_business_name, v_full_name
  from auth.users u
  where u.id = v_user_id;

  insert into public.profiles (id, full_name)
  values (v_user_id, v_full_name)
  on conflict (id) do update
    set full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name);

  insert into public.businesses (owner_id, name)
  values (v_user_id, v_business_name)
  returning id into v_business_id;

  insert into public.business_profiles (business_id, administrator_name)
  values (v_business_id, v_full_name)
  on conflict (business_id) do nothing;

  insert into public.business_accounts (
    business_id, account_status, payment_state, plan_name,
    trial_ends_at, due_date
  )
  values (
    v_business_id, 'trialing', 'paid', 'Prueba gratuita',
    now() + interval '14 days', current_date + 14
  )
  on conflict (business_id) do nothing;

  return query select v_business_id, v_business_name, true;
end;
$function$;

revoke all on function public.ensure_current_user_business() from public;
grant execute on function public.ensure_current_user_business() to authenticated;

notify pgrst, 'reload schema';
commit;

select
  to_regprocedure('public.ensure_current_user_business()') is not null as alta_automatica,
  has_function_privilege('authenticated', 'public.ensure_current_user_business()', 'EXECUTE') as alta_disponible,
  to_regprocedure('public.update_weekly_goal(uuid,numeric)') is not null as meta_persistente,
  to_regprocedure('public.admin_list_businesses()') is not null as panel_administrativo;
