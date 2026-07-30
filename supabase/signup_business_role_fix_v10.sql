-- MI BOLICHE · CORRECCIÓN DEL REGISTRO DE CUENTAS
-- Compatibiliza el rol "owner" usado por el trigger de alta con los roles
-- "manager" y "seller" usados para los miembros del equipo.
-- Es repetible y no elimina usuarios, negocios ni información operacional.

begin;

alter table public.business_members
  drop constraint if exists business_members_role_check;

alter table public.business_members
  add constraint business_members_role_check
  check (role in ('owner', 'manager', 'seller'));

notify pgrst, 'reload schema';
commit;

select
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'business_members'
      and c.conname = 'business_members_role_check'
      and pg_get_constraintdef(c.oid) like '%owner%'
      and pg_get_constraintdef(c.oid) like '%manager%'
      and pg_get_constraintdef(c.oid) like '%seller%'
  ) as registro_compatible,
  to_regprocedure('public.ensure_current_user_business()') is not null
    as alta_automatica,
  to_regprocedure('public.manage_business_member(uuid,text,text)') is not null
    as gestion_usuarios;
