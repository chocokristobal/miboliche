-- MI BOLICHE · CORRECCIÓN DE META SEMANAL Y ACCESO ADMINISTRATIVO · V5
-- Ejecutar el archivo completo en Supabase SQL Editor.
-- Es repetible y no elimina tablas, usuarios, productos, ventas ni inventario.

begin;

create or replace function public.update_weekly_goal(
  p_business_id uuid,
  p_weekly_goal numeric
)
returns numeric
language plpgsql
security definer
set search_path = public
as $function$
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
    updated_at = excluded.updated_at;

  return p_weekly_goal;
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
  to_regprocedure('public.update_weekly_goal(uuid,numeric)') is not null as guardar_meta_independiente,
  to_regprocedure('public.current_user_account_role()') is not null as acceso_admin_seguro,
  has_function_privilege(
    'authenticated',
    'public.update_weekly_goal(uuid,numeric)',
    'EXECUTE'
  ) as meta_disponible_para_usuario,
  has_function_privilege(
    'authenticated',
    'public.current_user_account_role()',
    'EXECUTE'
  ) as rol_disponible_para_usuario,
  coalesce((
    select string_agg(u.email::text, ', ' order by u.email::text)
    from public.platform_admins pa
    join auth.users u on u.id = pa.user_id
  ), 'Sin administrador registrado') as correos_administradores;
