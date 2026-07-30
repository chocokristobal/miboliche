-- MI BOLICHE · USUARIOS, ROLES, SOPORTE Y SEGURIDAD
-- Versión compatible con instalaciones que ya usan el enum business_role.
-- Ejecutar completa en Supabase SQL Editor.

begin;

alter table public.business_members
  add column if not exists role text not null default 'seller';

alter table public.business_members
  drop constraint if exists business_members_role_check;

alter table public.business_members
  alter column role drop default;
alter table public.business_members
  alter column role type text using role::text;

update public.business_members
set role = case
  when lower(role) in ('manager', 'admin', 'administrator', 'administrador', 'owner', 'propietario')
    then 'manager'
  else 'seller'
end;

alter table public.business_members
  alter column role set default 'seller',
  alter column role set not null;

alter table public.business_members
  add constraint business_members_role_check
  check (role in ('owner', 'manager', 'seller'));

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  requester_id uuid not null,
  subject text not null check (char_length(subject) between 4 and 120),
  description text not null check (char_length(description) between 10 and 3000),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'closed')),
  admin_response text not null default '',
  handled_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;
revoke all on table public.support_tickets from public;

create or replace function public.is_business_owner_or_manager(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.owner_id = auth.uid()
  ) or exists (
    select 1 from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
      and bm.role = 'manager'
  ) or public.is_platform_admin();
$function$;

create or replace function public.manage_business_member(
  p_business_id uuid,
  p_email text,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_user_id uuid;
begin
  if not public.is_business_owner_or_manager(p_business_id) then
    raise exception 'Solo el propietario o un administrador puede gestionar usuarios';
  end if;
  if p_role not in ('manager', 'seller') then
    raise exception 'Rol inválido';
  end if;
  select id into v_user_id from auth.users
  where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'Ese correo aún no tiene una cuenta en Mi Boliche';
  end if;
  if exists (select 1 from public.businesses where id = p_business_id and owner_id = v_user_id) then
    raise exception 'La persona propietaria ya tiene acceso total';
  end if;
  insert into public.business_members (business_id, user_id, role)
  values (p_business_id, v_user_id, p_role)
  on conflict (business_id, user_id) do update set role = excluded.role;
end;
$function$;

create or replace function public.create_support_ticket(
  p_business_id uuid,
  p_subject text,
  p_description text,
  p_priority text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_id uuid;
begin
  if not public.can_access_business(p_business_id) then
    raise exception 'No tienes acceso a este negocio';
  end if;
  if p_priority not in ('low', 'medium', 'high') then
    raise exception 'Prioridad inválida';
  end if;
  insert into public.support_tickets (
    business_id, requester_id, subject, description, priority
  ) values (
    p_business_id, auth.uid(), trim(p_subject), trim(p_description), p_priority
  ) returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.admin_list_support_tickets()
returns table (
  ticket_id uuid,
  business_id uuid,
  business_name text,
  requester_email text,
  subject text,
  description text,
  priority text,
  status text,
  admin_response text,
  created_at timestamptz,
  updated_at timestamptz
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
  select st.id, st.business_id, b.name, coalesce(u.email::text, ''),
    st.subject, st.description, st.priority, st.status, st.admin_response,
    st.created_at, st.updated_at
  from public.support_tickets st
  join public.businesses b on b.id = st.business_id
  left join auth.users u on u.id = st.requester_id
  order by
    case st.status when 'new' then 0 when 'in_progress' then 1 when 'resolved' then 2 else 3 end,
    case st.priority when 'high' then 0 when 'medium' then 1 else 2 end,
    st.created_at desc;
end;
$function$;

create or replace function public.admin_update_support_ticket(
  p_ticket_id uuid,
  p_status text,
  p_response text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_platform_admin() then
    raise exception 'Acceso exclusivo para administración';
  end if;
  if p_status not in ('new', 'in_progress', 'resolved', 'closed') then
    raise exception 'Estado inválido';
  end if;
  update public.support_tickets set
    status = p_status,
    admin_response = trim(coalesce(p_response, '')),
    handled_by = auth.uid(),
    updated_at = now()
  where id = p_ticket_id;
  if not found then raise exception 'Ticket no encontrado'; end if;
end;
$function$;

drop policy if exists "members read own support tickets" on public.support_tickets;
create policy "members read own support tickets"
  on public.support_tickets for select to authenticated
  using (public.can_access_business(business_id));

grant select on table public.support_tickets to authenticated;
revoke all on function public.is_business_owner_or_manager(uuid) from public;
revoke all on function public.manage_business_member(uuid,text,text) from public;
revoke all on function public.create_support_ticket(uuid,text,text,text) from public;
revoke all on function public.admin_list_support_tickets() from public;
revoke all on function public.admin_update_support_ticket(uuid,text,text) from public;
grant execute on function public.is_business_owner_or_manager(uuid) to authenticated;
grant execute on function public.manage_business_member(uuid,text,text) to authenticated;
grant execute on function public.create_support_ticket(uuid,text,text,text) to authenticated;
grant execute on function public.admin_list_support_tickets() to authenticated;
grant execute on function public.admin_update_support_ticket(uuid,text,text) to authenticated;

commit;

select
  (
    select data_type = 'text'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'business_members'
      and column_name = 'role'
  ) as roles_compatibles,
  to_regprocedure('public.manage_business_member(uuid,text,text)') is not null as gestion_usuarios,
  to_regclass('public.support_tickets') is not null as soporte_real,
  to_regprocedure('public.admin_list_support_tickets()') is not null as panel_soporte,
  to_regprocedure('public.is_business_owner_or_manager(uuid)') is not null as seguridad_por_rol;
