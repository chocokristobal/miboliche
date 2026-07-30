-- MI BOLICHE · META SEMANAL PERSISTENTE Y ADMINISTRADOR DEFINITIVO · V6
-- Ejecutar completo en Supabase SQL Editor.
-- No cambia contraseñas ni elimina usuarios, negocios, ventas o inventario.

begin;

do $block$
declare
  v_admin_user_id uuid;
begin
  select id
    into v_admin_user_id
  from auth.users
  where lower(email::text) = lower('veris.cvcomany@gmail.com')
  order by created_at desc
  limit 1;

  if v_admin_user_id is null then
    raise exception
      'No existe una cuenta en Supabase Authentication con el correo veris.cvcomany@gmail.com. Registra primero ese correo en Mi Boliche.';
  end if;

  -- El correo indicado reemplaza a cualquier administrador de prueba anterior.
  delete from public.platform_admins
  where user_id <> v_admin_user_id;

  insert into public.platform_admins (user_id)
  values (v_admin_user_id)
  on conflict (user_id) do nothing;
end;
$block$;

create or replace function public.update_weekly_goal(
  p_business_id uuid,
  p_weekly_goal numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_saved_goal numeric;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not public.is_business_writable(p_business_id) then
    raise exception 'El negocio no está habilitado para guardar cambios';
  end if;

  if p_weekly_goal is null or p_weekly_goal < 10000 then
    raise exception 'La meta semanal debe ser de al menos $10.000';
  end if;

  insert into public.business_profiles (
    business_id,
    weekly_goal,
    updated_by,
    updated_at
  )
  values (
    p_business_id,
    p_weekly_goal,
    auth.uid(),
    now()
  )
  on conflict (business_id) do update set
    weekly_goal = excluded.weekly_goal,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  returning weekly_goal into v_saved_goal;

  return v_saved_goal;
end;
$function$;

create or replace function public.current_user_account_role()
returns text
language sql
stable
security definer
set search_path = public
as $function$
  select case
    when auth.uid() is not null and public.is_platform_admin() then 'admin'
    else 'client'
  end;
$function$;

revoke all on function public.update_weekly_goal(uuid,numeric) from public;
revoke all on function public.current_user_account_role() from public;
grant execute on function public.update_weekly_goal(uuid,numeric) to authenticated;
grant execute on function public.current_user_account_role() to authenticated;

notify pgrst, 'reload schema';

commit;

select
  to_regprocedure('public.update_weekly_goal(uuid,numeric)') is not null
    as meta_persistente,
  has_function_privilege(
    'authenticated',
    'public.update_weekly_goal(uuid,numeric)',
    'EXECUTE'
  ) as meta_disponible,
  exists (
    select 1
    from public.platform_admins pa
    join auth.users u on u.id = pa.user_id
    where lower(u.email::text) = lower('veris.cvcomany@gmail.com')
  ) as administrador_veris,
  coalesce((
    select string_agg(u.email::text, ', ' order by u.email::text)
    from public.platform_admins pa
    join auth.users u on u.id = pa.user_id
  ), 'Sin administrador registrado') as correos_administradores;
